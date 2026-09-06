import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import type { ExpenseCategory, Receipt, ReceiptDraft } from '../expenses.types';
import type { OcrProgress, ProcessedReceiptImage, ReceiptOcrDiagnostics, ReceiptOcrGeometry, ReceiptOcrQuality, ReceiptOcrSourceType, ReceiptReviewDraft, ReceiptSourceQuality } from './receipt-ocr.types';
import { ReceiptScanReview } from './ReceiptScanReview';
import { createReceiptHeaderOcrChunk, createReceiptLocalNumericVerificationChunk, createReceiptValueColumnRecoveryChunk, preprocessReceiptImage } from './image-preprocess';
import { combineReceiptPdfPageTexts, renderReceiptPdfPages } from './receipt-pdf';
import { isReceiptPdfFile, validateReceiptScanFile } from './receipt-source';
import { applyCategorySuggestions } from './category-suggestions';
import { disposeReceiptOcrEngine, recognizeReceiptImageChunks } from './ocr-engine';
import { assessReceiptGeometryStructuredCandidate, reconstructReceiptTextFromGeometry } from './receipt-geometry-reconstruction';
import { applySelectedReceiptGeometryItems, decideReceiptGeometryProductionSelection, preservesReceiptPrimaryMetadata } from './receipt-geometry-production-selector';
import {
  evaluateReceiptLocalNumericVerificationShadow,
  extractReceiptLocalNumericCandidate,
  planReceiptLocalNumericVerification,
  promoteReceiptLocalNumericVerification,
  type ReceiptLocalNumericVerificationEvidence,
  type ReceiptLocalNumericVerificationProductionResult,
  type ReceiptLocalNumericVerificationShadowResult,
} from './receipt-local-numeric-verification';
import {
  compareReceiptValueColumnRecovery,
  countUsableReceiptValueRecoveryTokens,
  mergeReceiptOcrGeometryEvidence,
  planReceiptValueColumnRecovery,
  selectUsableReceiptValueRecoveryGeometry,
} from './receipt-value-column-recovery';
import { diagnoseReceiptDateText, diagnoseReceiptStructuralText, parseReceiptText, resolveReceiptMerchant, type ReceiptMerchantResolution } from './receipt-parser';
import { createReceiptReviewDraft } from './receipt-review.model';
import { analyzeReceiptOcrQuality } from './receipt-ocr-quality';
import { applyReceiptDegradedSafety } from './receipt-degraded-safety';
import { applyReceiptPartialRecovery } from './receipt-partial-recovery';
import { applyReceiptStrictOcrGates } from './receipt-strict-gating';
import {
  assessReceiptOcrCandidate,
  chooseReceiptOcrCandidate,
  describeReceiptOcrCandidate,
  shouldRecoverMerchantHeader,
  shouldRecoverReceiptFiscalRegion,
  shouldRetryReceiptFiscalThreshold,
  shouldRetryReceiptOcr,
  type ReceiptOcrCandidateAssessment,
} from './receipt-ocr-recovery';

interface ReceiptScanFlowProps {
  categories: ExpenseCategory[];
  receipts: Receipt[];
  onSave: (draft: ReceiptDraft) => Promise<void>;
  onClose: () => void;
  onManualAdd: () => void;
}

type ScanPhase = 'select' | 'processing' | 'review' | 'error';
type Rotation = 0 | 90 | 180 | 270;

function nextRotation(rotation: Rotation, direction: 'left' | 'right'): Rotation {
  const delta = direction === 'right' ? 90 : -90;
  return ((rotation + delta + 360) % 360) as Rotation;
}


function combineReceiptPrimaryGeometryForSnapshot(
  records: Array<{ primaryGeometry?: ReceiptOcrGeometry }>,
  fallback: ReceiptOcrGeometry | undefined,
): ReceiptOcrGeometry | undefined {
  const pages = records
    .map((record) => record.primaryGeometry)
    .filter((geometry): geometry is ReceiptOcrGeometry => Boolean(geometry));
  if (!pages.length) return fallback;
  if (pages.length === 1) return pages[0];
  return {
    source: 'primary',
    imageWidth: Math.max(...pages.map((geometry) => geometry.imageWidth)),
    imageHeight: Math.max(...pages.map((geometry) => geometry.imageHeight)),
    tokens: pages.flatMap((geometry) => geometry.tokens)
      .sort((left, right) => left.page - right.page
        || left.bbox.y0 - right.bbox.y0
        || left.bbox.x0 - right.bbox.x0
        || left.text.localeCompare(right.text, 'pl')),
  };
}

export function ReceiptScanFlow({ categories, receipts, onSave, onClose, onManualAdd }: ReceiptScanFlowProps) {
  const [phase, setPhase] = useState<ScanPhase>('select');
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [rotation, setRotation] = useState<Rotation>(0);
  const [progress, setProgress] = useState<OcrProgress>({ stage: 'preparing', label: 'Przygotowuję plik...' });
  const [review, setReview] = useState<ReceiptReviewDraft | null>(null);
  const [diagnosticOcrText, setDiagnosticOcrText] = useState('');
  const [diagnosticOcrMeta, setDiagnosticOcrMeta] = useState<ReceiptOcrDiagnostics | null>(null);
  const [diagnosticOcrQuality, setDiagnosticOcrQuality] = useState<ReceiptOcrQuality | null>(null);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const imageUrlRef = useRef('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    if (import.meta.env.DEV) {
      const debugWindow = window as Window & { __IK_PRIVATE_RECEIPT_GEOMETRY__?: unknown };
      delete debugWindow.__IK_PRIVATE_RECEIPT_GEOMETRY__;
    }
    void disposeReceiptOcrEngine();
  }, []);

  function replaceImageUrl(nextFile: File) {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    const next = URL.createObjectURL(nextFile);
    imageUrlRef.current = next;
    setImageUrl(next);
  }

  async function runOcr(targetFile: File, targetRotation: Rotation) {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setPhase('processing');
    setError('');
    setDiagnosticOcrText('');
    setDiagnosticOcrMeta(null);
    setDiagnosticOcrQuality(null);
    setProgress({ stage: 'preparing', label: 'Przygotowuję plik...' });
    try {
      const sourceType: ReceiptOcrSourceType = isReceiptPdfFile(targetFile) ? 'pdf' : 'photo';
      let resultText = '';
      let resultConfidence: number | undefined;
      let sourceQuality: ReceiptSourceQuality | undefined;
      let selectedAssessment: ReceiptOcrCandidateAssessment | undefined;
      let selectedGeometry: ReceiptOcrGeometry | undefined;
      const geometryByProfile = new Map<string, ReceiptOcrGeometry>();
      let merchantRecovery: ReceiptMerchantResolution | undefined;
      let merchantHeaderResolution: ReceiptMerchantResolution | undefined;
      const candidateAssessments: ReceiptOcrCandidateAssessment[] = [];
      let fullOcrPasses = 0;
      let fiscalOcrPasses = 0;
      let headerOcrPasses = 0;
      let fiscalRecoveryAttempted = false;
      let fiscalRecoverySelected = false;
      let fiscalThresholdRecoveryAttempted = false;
      let fiscalThresholdRecoverySelected = false;
      let merchantHeaderAttempted = false;
      let valueColumnRecoveryAttempted = false;
      let valueColumnRecoveryPasses = 0;
      let valueColumnRecoveryUsed = false;
      let numericVerificationPasses = 0;
      let numericVerificationShadow: ReceiptLocalNumericVerificationShadowResult | undefined;
      let numericVerificationProduction: ReceiptLocalNumericVerificationProductionResult | undefined;
      let photoProcessed: ProcessedReceiptImage | undefined;
      const processedByPage = new Map<number, ProcessedReceiptImage>();
      const valueColumnRecoveryRecords: Array<{
        plan: ReturnType<typeof planReceiptValueColumnRecovery>;
        primaryGeometry?: ReceiptOcrGeometry;
        mergedGeometry?: ReceiptOcrGeometry;
        rawText: string;
        geometry?: ReceiptOcrGeometry;
        usableGeometry?: ReceiptOcrGeometry;
        durationMs?: number;
        usableTokenCount: number;
        delta?: ReturnType<typeof compareReceiptValueColumnRecovery>;
      }> = [];

      const recoverValueColumn = async (
        processed: ProcessedReceiptImage,
        geometry: ReceiptOcrGeometry,
        labelPrefix = '',
      ): Promise<ReceiptOcrGeometry> => {
        const before = reconstructReceiptTextFromGeometry(geometry);
        const plan = planReceiptValueColumnRecovery(geometry, before);
        if (!plan.eligible) {
          valueColumnRecoveryRecords.push({ plan, primaryGeometry: geometry, rawText: '', usableTokenCount: 0 });
          return geometry;
        }
        valueColumnRecoveryAttempted = true;
        const chunk = await createReceiptValueColumnRecoveryChunk(processed, plan);
        if (!chunk || controller.signal.aborted) {
          valueColumnRecoveryRecords.push({ plan, primaryGeometry: geometry, rawText: '', usableTokenCount: 0 });
          return geometry;
        }
        setProgress({ stage: 'recognizing', progress: 0, label: `${labelPrefix}Odzyskuję kolumnę wartości...` });
        const startedAt = performance.now();
        const recovered = await recognizeReceiptImageChunks(
          [chunk],
          (next) => setProgress({ ...next, label: `${labelPrefix}Odzyskuję kolumnę wartości...` }),
          controller.signal,
          'value-column-recovery',
        );
        valueColumnRecoveryPasses += 1;
        if (controller.signal.aborted) return geometry;
        const durationMs = performance.now() - startedAt;
        const usableTokenCount = countUsableReceiptValueRecoveryTokens(recovered.geometry);
        const usableGeometry = selectUsableReceiptValueRecoveryGeometry(recovered.geometry);
        if (!usableGeometry?.tokens.length) {
          valueColumnRecoveryRecords.push({ plan, primaryGeometry: geometry, rawText: recovered.text, ...(recovered.geometry ? { geometry: recovered.geometry } : {}), durationMs, usableTokenCount });
          return geometry;
        }
        const merged = mergeReceiptOcrGeometryEvidence(geometry, usableGeometry);
        const after = reconstructReceiptTextFromGeometry(merged);
        const delta = compareReceiptValueColumnRecovery(before, after);
        valueColumnRecoveryUsed = usableTokenCount > 0;
        valueColumnRecoveryRecords.push({
          plan,
          primaryGeometry: geometry,
          mergedGeometry: merged,
          rawText: recovered.text,
          geometry: recovered.geometry ?? usableGeometry,
          usableGeometry,
          durationMs,
          usableTokenCount,
          delta,
        });
        return merged;
      };

      if (sourceType === 'pdf') {
        const pageTexts: string[] = [];
        const confidences: number[] = [];
        const pageDiagnostics: ReceiptOcrDiagnostics[] = [];
        const pageGeometries: ReceiptOcrGeometry[] = [];
        let totalChunks = 0;
        let pagesProcessed = 0;
        let pageCount = 0;
        let previewSet = false;

        setProgress({ stage: 'preparing', label: 'Renderuję PDF lokalnie...' });
        pageCount = await renderReceiptPdfPages(targetFile, async (rendered) => {
          if (controller.signal.aborted) return;
          if (!previewSet) {
            replaceImageUrl(rendered.file);
            previewSet = true;
          }
          setProgress({ stage: 'preparing', progress: (rendered.pageNumber - 1) / rendered.pageCount, label: `Przygotowuję stronę ${rendered.pageNumber} z ${rendered.pageCount}...` });
          const processed = await preprocessReceiptImage(rendered.file, targetRotation, 'pdf');
          if (controller.signal.aborted) return;
          processed.chunks.forEach((chunk) => { chunk.page = rendered.pageNumber; });
          processedByPage.set(rendered.pageNumber, processed);
          pageDiagnostics.push(processed.diagnostics);
          totalChunks += processed.chunks.length;
          const result = await recognizeReceiptImageChunks(processed.chunks, (next) => {
            const localProgress = next.progress ?? 0;
            setProgress({
              ...next,
              progress: Math.min(1, (rendered.pageNumber - 1 + localProgress) / rendered.pageCount),
              label: `Strona ${rendered.pageNumber} z ${rendered.pageCount}: ${next.label}`,
            });
          }, controller.signal);
          if (controller.signal.aborted) return;
          pageTexts.push(result.text);
          if (typeof result.confidence === 'number') confidences.push(result.confidence);
          if (result.geometry) {
            const recoveredGeometry = await recoverValueColumn(
              processed,
              result.geometry,
              `Strona ${rendered.pageNumber} z ${rendered.pageCount}: `,
            );
            if (controller.signal.aborted) return;
            pageGeometries.push(recoveredGeometry);
          }
          pagesProcessed += 1;
        }, controller.signal);
        if (controller.signal.aborted) return;
        resultText = combineReceiptPdfPageTexts(pageTexts);
        resultConfidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : undefined;
        if (pageGeometries.length) {
          selectedGeometry = {
            source: 'primary',
            imageWidth: Math.max(...pageGeometries.map((geometry) => geometry.imageWidth)),
            imageHeight: Math.max(...pageGeometries.map((geometry) => geometry.imageHeight)),
            tokens: pageGeometries.flatMap((geometry) => geometry.tokens),
          };
        }
        const diagnostics = pageDiagnostics[0];
        if (diagnostics) {
          sourceQuality = diagnostics.sourceQuality;
          setDiagnosticOcrMeta({ ...diagnostics, pageCount, pagesProcessed, chunkCount: totalChunks });
        }
      } else {
        const processed = await preprocessReceiptImage(targetFile, targetRotation, sourceType);
        photoProcessed = processed;
        processedByPage.set(1, processed);
        if (controller.signal.aborted) return;
        sourceQuality = processed.diagnostics.sourceQuality;
        setDiagnosticOcrMeta(processed.diagnostics);
        setProgress({ stage: 'recognizing', progress: 0, label: processed.chunks.length > 1 ? `Rozpoznaję fragment 1 z ${processed.chunks.length}...` : 'Rozpoznaję tekst...' });
        const primaryResult = await recognizeReceiptImageChunks(processed.chunks, (next) => setProgress(next), controller.signal, 'primary');
        fullOcrPasses += 1;
        if (controller.signal.aborted) return;
        const primaryAssessment = assessReceiptOcrCandidate('primary', primaryResult.text, sourceType, primaryResult.confidence);
        candidateAssessments.push(primaryAssessment);
        if (primaryResult.geometry) geometryByProfile.set('primary', primaryResult.geometry);
        selectedAssessment = primaryAssessment;

        if (shouldRetryReceiptOcr(primaryAssessment)) {
          setProgress({ stage: 'recognizing', progress: 0, label: 'Ponowna analiza paragonu...' });
          const recoveryResult = await recognizeReceiptImageChunks(
            processed.chunks,
            (next) => setProgress({ ...next, label: next.progress === 1 ? 'Kończę ponowną analizę...' : 'Ponowna analiza paragonu...' }),
            controller.signal,
            'single-block-recovery',
          );
          fullOcrPasses += 1;
          if (controller.signal.aborted) return;
          const recoveryAssessment = assessReceiptOcrCandidate('single-block-recovery', recoveryResult.text, sourceType, recoveryResult.confidence);
          candidateAssessments.push(recoveryAssessment);
          if (recoveryResult.geometry) geometryByProfile.set('single-block-recovery', recoveryResult.geometry);
          selectedAssessment = chooseReceiptOcrCandidate(primaryAssessment, recoveryAssessment);
        }

        if (shouldRecoverReceiptFiscalRegion(
          selectedAssessment,
          sourceQuality,
          Boolean(processed.fiscalRecoveryChunk),
        ) && processed.fiscalRecoveryChunk) {
          fiscalRecoveryAttempted = true;
          setProgress({ stage: 'recognizing', progress: 0, label: 'Odzyskuję część fiskalną paragonu...' });
          const fiscalResult = await recognizeReceiptImageChunks(
            [processed.fiscalRecoveryChunk],
            (next) => setProgress({ ...next, label: next.progress === 1 ? 'Kończę odzyskiwanie części fiskalnej...' : 'Odzyskuję część fiskalną paragonu...' }),
            controller.signal,
            'fiscal-region-recovery',
          );
          fiscalOcrPasses += 1;
          if (controller.signal.aborted) return;
          const fiscalAssessment = assessReceiptOcrCandidate(
            'fiscal-region-recovery',
            fiscalResult.text,
            sourceType,
            fiscalResult.confidence,
          );
          candidateAssessments.push(fiscalAssessment);
          if (fiscalResult.geometry) geometryByProfile.set('fiscal-region-recovery', fiscalResult.geometry);
          let chosen = chooseReceiptOcrCandidate(selectedAssessment, fiscalAssessment);
          fiscalRecoverySelected = chosen === fiscalAssessment;
          selectedAssessment = chosen;

          if (shouldRetryReceiptFiscalThreshold(
            fiscalAssessment,
            selectedAssessment,
            Boolean(processed.fiscalThresholdRecoveryChunk),
          ) && processed.fiscalThresholdRecoveryChunk) {
            fiscalThresholdRecoveryAttempted = true;
            setProgress({ stage: 'recognizing', progress: 0, label: 'Wzmacniam kontrast części fiskalnej...' });
            const thresholdResult = await recognizeReceiptImageChunks(
              [processed.fiscalThresholdRecoveryChunk],
              (next) => setProgress({ ...next, label: next.progress === 1 ? 'Kończę analizę kontrastową...' : 'Wzmacniam kontrast części fiskalnej...' }),
              controller.signal,
              'fiscal-threshold-recovery',
            );
            fiscalOcrPasses += 1;
            if (controller.signal.aborted) return;
            const thresholdAssessment = assessReceiptOcrCandidate(
              'fiscal-threshold-recovery',
              thresholdResult.text,
              sourceType,
              thresholdResult.confidence,
            );
            candidateAssessments.push(thresholdAssessment);
            if (thresholdResult.geometry) geometryByProfile.set('fiscal-threshold-recovery', thresholdResult.geometry);
            chosen = chooseReceiptOcrCandidate(selectedAssessment, thresholdAssessment);
            fiscalThresholdRecoverySelected = chosen === thresholdAssessment;
            selectedAssessment = chosen;
            fiscalRecoverySelected = selectedAssessment.profile === 'fiscal-region-recovery'
              || selectedAssessment.profile === 'fiscal-threshold-recovery';
          }
        }

        resultText = selectedAssessment.text;
        resultConfidence = selectedAssessment.confidence;
        selectedGeometry = geometryByProfile.get(selectedAssessment.profile);

        if (shouldRecoverMerchantHeader(selectedAssessment.parsed, sourceType)) {
          merchantHeaderAttempted = true;
          const headerChunk = await createReceiptHeaderOcrChunk(
            processed,
            0.42,
            Boolean(processed.fiscalRecoveryChunk),
          );
          if (headerChunk && !controller.signal.aborted) {
            setProgress({ stage: 'recognizing', progress: 0, label: 'Sprawdzam nazwę sklepu...' });
            const headerResult = await recognizeReceiptImageChunks(
              [headerChunk],
              (next) => setProgress({ ...next, label: 'Sprawdzam nazwę sklepu...' }),
              controller.signal,
              'header-recovery',
            );
            headerOcrPasses += 1;
            if (controller.signal.aborted) return;
            const resolved = resolveReceiptMerchant(resultText, headerResult.text);
            merchantHeaderResolution = resolved;
            // Only an accepted, non-low-confidence supplemental result may replace
            // the selected OCR merchant. Rejected plain header tokens remain
            // diagnostic-only and never populate the review field.
            if (resolved.merchant && resolved.confidence !== 'low' && resolved.decision === 'accepted') merchantRecovery = resolved;
          }
        }
      }

      if (sourceType === 'photo' && selectedGeometry?.source === 'primary' && photoProcessed) {
        selectedGeometry = await recoverValueColumn(photoProcessed, selectedGeometry);
        if (controller.signal.aborted) return;
      }

      const geometryReconstruction = selectedGeometry
        ? reconstructReceiptTextFromGeometry(selectedGeometry)
        : undefined;
      const geometryRowMajorParsed = geometryReconstruction?.applied
        ? parseReceiptText(geometryReconstruction.rowMajorText)
        : undefined;
      const geometryParsed = geometryReconstruction?.applied
        ? parseReceiptText(geometryReconstruction.text)
        : undefined;
      const geometryStructuredAssessment = geometryReconstruction && geometryParsed
        ? assessReceiptGeometryStructuredCandidate(geometryReconstruction, geometryParsed)
        : undefined;
      const primaryParsedForGeometrySelection = selectedAssessment?.parsed ?? parseReceiptText(resultText);
      const recoveryEvidence = {
        attempted: valueColumnRecoveryAttempted,
        passCount: valueColumnRecoveryPasses,
        used: valueColumnRecoveryUsed,
        eligiblePlanCount: valueColumnRecoveryRecords.filter((record) => record.plan.eligible).length,
        usableTokenCount: valueColumnRecoveryRecords.reduce((sum, record) => sum + record.usableTokenCount, 0),
        recoveryTokenCount: selectedGeometry?.tokens.filter((token) => token.source === 'value-column-recovery').length ?? 0,
        deltas: valueColumnRecoveryRecords.flatMap((record) => record.delta ? [record.delta] : []),
        plans: valueColumnRecoveryRecords.map((record) => record.plan),
      };
      let geometrySelection = decideReceiptGeometryProductionSelection({
        primary: primaryParsedForGeometrySelection,
        geometryCandidate: geometryParsed,
        reconstruction: geometryReconstruction,
        structuredAssessment: geometryStructuredAssessment,
        recovery: recoveryEvidence,
      });
      let parsedBeforeMerchantRecovery = primaryParsedForGeometrySelection;
      if (geometrySelection.decision !== 'KEEP_PRIMARY' && geometryParsed) {
        try {
          const merged = applySelectedReceiptGeometryItems(primaryParsedForGeometrySelection, geometryParsed);
          if (!preservesReceiptPrimaryMetadata(primaryParsedForGeometrySelection, merged)) {
            geometrySelection = { ...geometrySelection, decision: 'KEEP_PRIMARY', reason: 'primary-metadata-regression' };
          } else {
            parsedBeforeMerchantRecovery = merged;
          }
        } catch {
          geometrySelection = { ...geometrySelection, decision: 'KEEP_PRIMARY', reason: 'merge-failed' };
          parsedBeforeMerchantRecovery = primaryParsedForGeometrySelection;
        }
      }

      // DEV4-B-FIX2 is shadow-only. It may spend at most two cell-level OCR passes
      // after the production decision has already been made. The resulting evidence
      // is diagnostic and must never modify selectedGeometry, geometrySelection, or
      // parsedBeforeMerchantRecovery in this experiment gate.
      if (selectedGeometry && geometryReconstruction && geometryParsed) {
        const numericPlan = planReceiptLocalNumericVerification({
          geometry: selectedGeometry,
          reconstruction: geometryReconstruction,
          geometryCandidate: geometryParsed,
          structuredAssessment: geometryStructuredAssessment,
          primaryItemCount: primaryParsedForGeometrySelection.items.length,
          productionDecision: geometrySelection.decision,
          recoveryAttempted: valueColumnRecoveryAttempted,
          recoveryUsed: valueColumnRecoveryUsed,
        });
        const numericEvidence: ReceiptLocalNumericVerificationEvidence[] = [];
        if (numericPlan.eligible) {
          for (let index = 0; index < numericPlan.cells.length; index += 1) {
            const cell = numericPlan.cells[index];
            if (!cell || controller.signal.aborted) break;
            const processed = processedByPage.get(cell.page) ?? (cell.page === 1 ? photoProcessed : undefined);
            if (!processed) {
              numericEvidence.push({ cellId: cell.id, rawText: '' });
              continue;
            }
            const chunk = await createReceiptLocalNumericVerificationChunk(processed, cell);
            if (!chunk || controller.signal.aborted) {
              numericEvidence.push({ cellId: cell.id, rawText: '' });
              continue;
            }
            setProgress({
              stage: 'recognizing',
              progress: index / numericPlan.cells.length,
              label: `Weryfikuję podejrzaną kwotę ${index + 1} z ${numericPlan.cells.length}...`,
            });
            const localResult = await recognizeReceiptImageChunks(
              [chunk],
              (next) => setProgress({
                ...next,
                label: `Weryfikuję podejrzaną kwotę ${index + 1} z ${numericPlan.cells.length}...`,
              }),
              controller.signal,
              'local-numeric-verification',
            );
            numericVerificationPasses += 1;
            if (controller.signal.aborted) return;
            const candidate = extractReceiptLocalNumericCandidate(localResult);
            numericEvidence.push({
              cellId: cell.id,
              rawText: localResult.text,
              ...(localResult.confidence === undefined ? {} : { recognitionConfidence: localResult.confidence }),
              ...(candidate ? { candidate } : {}),
            });
          }
        }
        numericVerificationShadow = evaluateReceiptLocalNumericVerificationShadow(
          selectedGeometry,
          geometryReconstruction,
          numericPlan,
          numericEvidence,
        );
        const numericShadowParsed = numericVerificationShadow.shadowReconstruction
          ? parseReceiptText(numericVerificationShadow.shadowReconstruction.text)
          : undefined;
        numericVerificationProduction = promoteReceiptLocalNumericVerification({
          primary: primaryParsedForGeometrySelection,
          preShadowCandidate: geometryParsed,
          originalReconstruction: geometryReconstruction,
          shadowCandidate: numericShadowParsed,
          plan: numericPlan,
          shadow: numericVerificationShadow,
          passCount: numericVerificationPasses,
          productionDecision: geometrySelection.decision,
        });
        if (numericVerificationProduction.productionApplied && numericVerificationProduction.parsed) {
          parsedBeforeMerchantRecovery = numericVerificationProduction.parsed;
        }
      }

      const geometrySelected = geometrySelection.decision !== 'KEEP_PRIMARY';
      if (import.meta.env.DEV) {
        const debugWindow = window as Window & { __IK_PRIVATE_RECEIPT_GEOMETRY__?: unknown };
        if (selectedGeometry && geometryReconstruction) {
          debugWindow.__IK_PRIVATE_RECEIPT_GEOMETRY__ = {
            private: true,
            doNotPublish: true,
            productionEngineSnapshot: true,
            provenance: {
              engine: 'Tesseract.js',
              engineVersion: '7.0.0',
              source: 'browser-live',
              sourceFileName: targetFile.name,
              sourceType,
              candidate: selectedGeometry.source,
              imageWidth: selectedGeometry.imageWidth,
              imageHeight: selectedGeometry.imageHeight,
              tokenCount: selectedGeometry.tokens.filter((token) => token.source !== 'value-column-recovery').length,
              mergedTokenCount: selectedGeometry.tokens.length,
            },
            primaryGeometry: combineReceiptPrimaryGeometryForSnapshot(valueColumnRecoveryRecords, selectedGeometry),
            geometry: selectedGeometry,
            rowMajorText: geometryReconstruction.rowMajorText,
            reconstructedText: geometryReconstruction.text,
            structuredTextGenerated: geometryReconstruction.structuredTextGenerated,
            structuredTextApplied: geometryStructuredAssessment?.accepted ?? false,
            structuredCandidateAccepted: geometryStructuredAssessment?.accepted ?? false,
            structuredCandidateRejectionReasons: geometryStructuredAssessment?.rejectionReasons ?? [],
            reconstructedItems: geometryReconstruction.items,
            reconstructionSummary: {
              completeItemCount: geometryReconstruction.completeItemCount,
              grossItemsTotalMinor: geometryReconstruction.grossItemsTotalMinor,
              discountsTotalMinor: geometryReconstruction.discountsTotalMinor,
              itemsTotalMinor: geometryReconstruction.itemsTotalMinor,
              unresolvedItemCount: geometryReconstruction.items.filter((item) => item.finalAmountMinor === undefined).length,
              discountUnresolvedCount: geometryReconstruction.items.filter((item) => item.unresolvedReason === 'discount-unresolved').length,
              quantityUnresolvedCount: geometryReconstruction.items.filter((item) => item.unresolvedReason === 'quantity-unresolved').length,
            },
            valueRecovery: {
              attempted: valueColumnRecoveryAttempted,
              passCount: valueColumnRecoveryPasses,
              used: valueColumnRecoveryUsed,
              pages: valueColumnRecoveryRecords,
            },
            rowMajorParsed: geometryRowMajorParsed,
            structuredParsed: geometryParsed,
            productionSelection: geometrySelection,
            ...(numericVerificationShadow ? {
              numericVerification: {
                experiment: true,
                triggered: numericVerificationShadow.triggered,
                reason: numericVerificationShadow.reason,
                suspectCellCount: numericVerificationShadow.suspectCellCount,
                passBudget: numericVerificationShadow.passBudget,
                passCount: numericVerificationPasses,
                cells: numericVerificationShadow.cells,
                before: numericVerificationShadow.before,
                afterShadow: numericVerificationShadow.afterShadow,
                acceptedReplacementCount: numericVerificationShadow.acceptedReplacementCount,
                productionApplied: numericVerificationProduction?.productionApplied ?? false,
                productionReason: numericVerificationProduction?.reason ?? 'not-triggered',
                ...(numericVerificationProduction?.verifiedItemsTotalMinor === undefined ? {} : { verifiedItemsTotalMinor: numericVerificationProduction.verifiedItemsTotalMinor }),
                ...(numericVerificationProduction?.depositTotalMinor === undefined ? {} : { depositTotalMinor: numericVerificationProduction.depositTotalMinor }),
                ...(numericVerificationProduction?.finalPayableMinor === undefined ? {} : { finalPayableMinor: numericVerificationProduction.finalPayableMinor }),
                ...(numericVerificationProduction?.paymentTotalMinor === undefined ? {} : { paymentTotalMinor: numericVerificationProduction.paymentTotalMinor }),
                ...(numericVerificationProduction?.unexplainedDifferenceMinor === undefined ? {} : { unexplainedDifferenceMinor: numericVerificationProduction.unexplainedDifferenceMinor }),
              },
            } : {}),
          };
        } else {
          delete debugWindow.__IK_PRIVATE_RECEIPT_GEOMETRY__;
        }
      }
      setDiagnosticOcrMeta((current) => current ? {
        ...current,
        geometryAvailable: Boolean(selectedGeometry?.tokens.length),
        ...(selectedGeometry ? {
          geometrySource: selectedGeometry.source,
          geometryTokenCount: geometryReconstruction?.validTokenCount ?? selectedGeometry.tokens.length,
          geometryInvalidTokenCount: geometryReconstruction?.invalidTokenCount ?? 0,
          geometryRowCount: geometryReconstruction?.rows.length ?? 0,
          geometryColumnSource: geometryReconstruction?.columns?.source ?? 'none',
          ...(geometryReconstruction?.columns?.confidence === undefined ? {} : { geometryColumnConfidence: geometryReconstruction.columns.confidence }),
          geometryReconstructedItemCount: geometryReconstruction?.items.length ?? 0,
          geometryReconstructedCompleteItemCount: geometryReconstruction?.completeItemCount ?? 0,
          geometryReconstructedGrossTotalMinor: geometryReconstruction?.grossItemsTotalMinor ?? 0,
          geometryReconstructedDiscountTotalMinor: geometryReconstruction?.discountsTotalMinor ?? 0,
          geometryReconstructedItemsTotalMinor: geometryReconstruction?.itemsTotalMinor ?? 0,
          geometryReconstructedUnresolvedItemCount: geometryReconstruction?.items.filter((item) => item.finalAmountMinor === undefined).length ?? 0,
          geometryReconstructedDiscountUnresolvedCount: geometryReconstruction?.items.filter((item) => item.unresolvedReason === 'discount-unresolved').length ?? 0,
          geometryReconstructedQuantityUnresolvedCount: geometryReconstruction?.items.filter((item) => item.unresolvedReason === 'quantity-unresolved').length ?? 0,
          geometryRowMajorParsedItemCount: geometryRowMajorParsed?.items.length ?? 0,
          geometryRowMajorParsedItemsTotalMinor: geometryRowMajorParsed?.detectedItemsTotalMinor ?? 0,
          geometryParsedItemCount: geometryParsed?.items.length ?? 0,
          geometryParsedItemsTotalMinor: geometryParsed?.detectedItemsTotalMinor ?? 0,
          geometryStructuredTextGenerated: geometryReconstruction?.structuredTextGenerated ?? false,
          geometryStructuredTextApplied: geometryStructuredAssessment?.accepted ?? false,
          geometryStructuredCandidateAccepted: geometryStructuredAssessment?.accepted ?? false,
          geometryStructuredCandidateRejectionReasons: geometryStructuredAssessment?.rejectionReasons ?? [],
          valueColumnRecoveryAttempted,
          valueColumnRecoveryPasses,
          valueColumnRecoveryUsed,
          ...(valueColumnRecoveryRecords.find((record) => record.plan.crop)?.plan.crop ? (() => {
            const crop = valueColumnRecoveryRecords.find((record) => record.plan.crop)!.plan.crop!;
            const record = valueColumnRecoveryRecords.find((entry) => entry.plan.crop)!;
            const delta = [...valueColumnRecoveryRecords].reverse().find((entry) => entry.delta)?.delta;
            return {
              valueColumnRecoveryCropX0: crop.x0,
              valueColumnRecoveryCropY0: crop.y0,
              valueColumnRecoveryCropX1: crop.x1,
              valueColumnRecoveryCropY1: crop.y1,
              valueColumnRecoveryCropPixels: record.plan.pixelCount ?? ((crop.x1 - crop.x0) * (crop.y1 - crop.y0)),
              valueColumnRecoveryTokenCount: valueColumnRecoveryRecords.reduce((sum, entry) => sum + (entry.geometry?.tokens.length ?? 0), 0),
              valueColumnRecoveryUsableTokenCount: valueColumnRecoveryRecords.reduce((sum, entry) => sum + entry.usableTokenCount, 0),
              ...(delta ? {
                valueColumnRecoveryRecoveredGrossCells: delta.recoveredGrossCells,
                valueColumnRecoveryRecoveredDiscountCells: delta.recoveredDiscountCells,
                valueColumnRecoveryRecoveredNetCells: delta.recoveredNetCells,
                valueColumnRecoveryRecoveredCompleteGroups: delta.recoveredCompleteGroups,
              } : {}),
            };
          })() : {}),
          ...(geometryParsed?.finalPayableMinor === undefined && geometryParsed?.declaredTotalMinor === undefined ? {} : { geometryParsedFinalTotalMinor: geometryParsed.finalPayableMinor ?? geometryParsed.declaredTotalMinor }),
          ...(geometryParsed?.paymentTotalMinor === undefined ? {} : { geometryParsedPaymentTotalMinor: geometryParsed.paymentTotalMinor }),
        } : {}),
        geometrySelected,
        geometrySelectionDecision: geometrySelection.decision,
        geometrySelectionReason: geometrySelection.reason,
        numericVerificationTriggered: numericVerificationShadow?.triggered ?? false,
        numericVerificationPasses,
        numericVerificationSuspectCellCount: numericVerificationShadow?.suspectCellCount ?? 0,
        numericVerificationAcceptedShadowReplacements: numericVerificationShadow?.acceptedReplacementCount ?? 0,
        numericVerificationShadowFinanciallyConsistent: numericVerificationShadow?.afterShadow.financiallyConsistent ?? false,
      } : current);

      if (sourceType === 'photo') {
        const dateDiagnostic = diagnoseReceiptDateText(resultText);
        const structuralDiagnostic = diagnoseReceiptStructuralText(resultText);
        const selectedGate = selectedAssessment
          ? applyReceiptStrictOcrGates(selectedAssessment.parsed, selectedAssessment.quality)
          : undefined;
        const merchantRecoverySource = merchantRecovery?.merchant
          ? 'header'
          : selectedGate?.parsed.merchant
            ? selectedAssessment!.profile
            : 'unresolved';
        const candidateDiagnostics = candidateAssessments.map((candidate) => (
          describeReceiptOcrCandidate(candidate, candidate === selectedAssessment)
        ));
        setDiagnosticOcrMeta((current) => current ? {
          ...current,
          fiscalRecoveryAttempted,
          fiscalRecoverySelected,
          fiscalThresholdRecoveryAttempted,
          fiscalThresholdRecoverySelected,
          merchantHeaderAttempted,
          dateRecoverySource: dateDiagnostic.date && selectedAssessment ? selectedAssessment.profile : 'unresolved',
          dateDecision: dateDiagnostic.decision,
          dateRejectReason: dateDiagnostic.rejectReason,
          itemBlockSource: geometrySelection.decision === 'SELECT_RECOVERY'
            ? 'geometry-value-recovery'
            : geometrySelection.decision === 'SELECT_STRUCTURED_GEOMETRY'
              ? 'geometry-structured-consensus'
              : selectedGate?.parsed.items.length ? selectedAssessment!.profile : 'unresolved',
          footerContaminationDetected: structuralDiagnostic.footerContaminationDetected,
          merchantRecoverySource,
          ...(merchantHeaderResolution?.candidate === undefined ? {} : { merchantCandidate: merchantHeaderResolution.candidate }),
          merchantEvidence: merchantHeaderResolution?.evidence ?? 'none',
          merchantDecision: merchantHeaderResolution?.decision ?? (selectedGate?.merchantRejected ? 'rejected' : merchantRecoverySource === 'unresolved' ? 'unresolved' : 'accepted'),
          merchantRejectReason: merchantHeaderResolution?.rejectReason ?? (selectedGate?.merchantRejected ? 'low-evidence' : 'none'),
          candidateDiagnostics,
          fullOcrPasses,
          fiscalOcrPasses,
          headerOcrPasses,
          valueColumnRecoveryAttempted,
          valueColumnRecoveryPasses,
          valueColumnRecoveryUsed,
        } : current);
      }
      setDiagnosticOcrText(resultText);
      const quality = selectedAssessment?.quality ?? analyzeReceiptOcrQuality(resultText, sourceType, resultConfidence);
      setDiagnosticOcrQuality(quality);
      setProgress({ stage: 'parsing', label: 'Analizuję paragon...' });
      const strictGated = applyReceiptStrictOcrGates(parsedBeforeMerchantRecovery, quality);
      const baseParsed = merchantRecovery?.merchant
        ? {
            ...strictGated.parsed,
            merchant: merchantRecovery.merchant,
            merchantConfidence: merchantRecovery.confidence,
            warnings: [
              ...strictGated.parsed.warnings.filter((warning) => warning.code !== 'merchant-uncertain'),
              ...merchantRecovery.warnings,
            ],
          }
        : strictGated.parsed;
      const degradedSafe = applyReceiptDegradedSafety(baseParsed, sourceQuality, quality);
      const recovered = applyReceiptPartialRecovery(resultText, baseParsed, degradedSafe, sourceQuality, quality);
      const parsed = applyCategorySuggestions(
        recovered,
        receipts,
        categories,
      );
      const nextReview = createReceiptReviewDraft(parsed, categories);
      if (controller.signal.aborted) return;
      setReview(nextReview);
      setDirty(false);
      setPhase('review');
    } catch (cause) {
      if (controller.signal.aborted || (cause instanceof DOMException && cause.name === 'AbortError')) return;
      setError(cause instanceof Error ? cause.message : 'Nie udało się odczytać paragonu.');
      setPhase('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    try {
      validateReceiptScanFile(selected);
      setFile(selected);
      setRotation(0);
      setReview(null);
      setDiagnosticOcrText('');
      setDiagnosticOcrMeta(null);
      setDiagnosticOcrQuality(null);
      if (import.meta.env.DEV) {
        const debugWindow = window as Window & { __IK_PRIVATE_RECEIPT_GEOMETRY__?: unknown };
        delete debugWindow.__IK_PRIVATE_RECEIPT_GEOMETRY__;
      }
      setDirty(false);
      if (isReceiptPdfFile(selected)) {
        if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = '';
        setImageUrl('');
      } else {
        replaceImageUrl(selected);
      }
      void runOcr(selected, 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wybrać pliku paragonu.');
      setPhase('error');
    }
  }

  function rotate(direction: 'left' | 'right') {
    setRotation((current) => nextRotation(current, direction));
  }

  function rotateAndRetry(direction: 'left' | 'right') {
    if (!file) return;
    const next = nextRotation(rotation, direction);
    setRotation(next);
    void runOcr(file, next);
  }

  function closeFlow() {
    if (dirty && phase === 'review' && !window.confirm('Porzucić poprawki w tym paragonie?')) return;
    abortRef.current?.abort();
    onClose();
  }

  async function saveDraft(draft: ReceiptDraft) {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
      // Persistence succeeded. Only now release transient receipt/OCR resources.
      setDiagnosticOcrText('');
      setDiagnosticOcrMeta(null);
      setDiagnosticOcrQuality(null);
      if (import.meta.env.DEV) {
        const debugWindow = window as Window & { __IK_PRIVATE_RECEIPT_GEOMETRY__?: unknown };
        delete debugWindow.__IK_PRIVATE_RECEIPT_GEOMETRY__;
      }
      setReview(null);
      setFile(null);
      setDirty(false);
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = '';
      }
      setImageUrl('');
    } catch (cause) {
      // Keep the full review and transient OCR source in memory so the user can retry.
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać paragonu.');
      throw cause;
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  const progressPercent = typeof progress.progress === 'number' ? Math.round(progress.progress * 100) : null;

  return (
    <div className="receipt-scan-backdrop" role="presentation" onMouseDown={closeFlow}>
      <section className="receipt-scan-shell" role="dialog" aria-modal="true" aria-labelledby="receipt-scan-title" onMouseDown={(event: ReactMouseEvent<HTMLElement>) => event.stopPropagation()}>
        <header className="receipt-scan-shell-header">
          <div>
            <p className="section-kicker">Wydatki</p>
            <h1 id="receipt-scan-title">Skanuj paragon</h1>
          </div>
          <button type="button" className="icon-button" onClick={closeFlow} aria-label="Zamknij skanowanie">×</button>
        </header>

        {phase === 'select' ? (
          <div className="receipt-scan-select">
            <div className="receipt-scan-select-mark" aria-hidden="true">OCR</div>
            <h2>Dodaj zdjęcie lub PDF paragonu</h2>
            <p>Zdjęcie lub PDF paragonu (do 6 stron) jest przetwarzany lokalnie i nie jest zapisywany po zakończeniu skanowania.</p>
            <div className="receipt-scan-source-actions" role="group" aria-label="Źródło paragonu">
              <input ref={cameraInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={selectFile} />
              <input ref={galleryInputRef} className="visually-hidden" type="file" accept="image/*,application/pdf,.pdf" onChange={selectFile} />
              <button type="button" className="button button-primary" onClick={() => cameraInputRef.current?.click()}>Zrób zdjęcie</button>
              <button type="button" className="button button-secondary" onClick={() => galleryInputRef.current?.click()}>Wybierz zdjęcie / PDF</button>
            </div>
            <button type="button" className="text-button" onClick={onManualAdd}>Dodaj paragon ręcznie</button>
          </div>
        ) : null}

        {phase === 'processing' ? (
          <div className="receipt-scan-processing" aria-live="polite">
            {imageUrl ? <div className="receipt-scan-processing-thumb"><img src={imageUrl} alt="Podgląd wybranego paragonu" style={{ transform: `rotate(${rotation}deg)` }} /></div> : null}
            <div className="receipt-scan-processing-copy">
              <strong>{progress.label}</strong>
              {progressPercent !== null ? <><progress max="100" value={progressPercent}>{progressPercent}%</progress><span>{progressPercent}%</span></> : null}
              <p>Rozpoznawanie działa na tym urządzeniu.</p>
              <button type="button" className="button button-secondary" onClick={closeFlow}>Anuluj</button>
            </div>
          </div>
        ) : null}

        {phase === 'error' ? (
          <div className="receipt-scan-error" role="alert">
            <strong>Nie udało się odczytać paragonu.</strong>
            <p>{error || 'Możesz spróbować ponownie, obrócić podgląd albo dodać paragon ręcznie.'}</p>
            <div className="receipt-scan-error-actions">
              {file ? <button type="button" className="button button-primary" onClick={() => void runOcr(file, rotation)}>Spróbuj ponownie</button> : null}
              {file ? <button type="button" className="button button-secondary" onClick={() => rotateAndRetry('left')}>Obróć w lewo</button> : null}
              {file ? <button type="button" className="button button-secondary" onClick={() => rotateAndRetry('right')}>Obróć w prawo</button> : null}
              {!file ? <button type="button" className="button button-primary" onClick={() => cameraInputRef.current?.click()}>Zrób zdjęcie</button> : null}
              {!file ? <button type="button" className="button button-secondary" onClick={() => galleryInputRef.current?.click()}>Wybierz zdjęcie / PDF</button> : null}
              <button type="button" className="text-button" onClick={onManualAdd}>Dodaj ręcznie</button>
              <button type="button" className="text-button" onClick={closeFlow}>Anuluj</button>
            </div>
            <input ref={cameraInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={selectFile} />
            <input ref={galleryInputRef} className="visually-hidden" type="file" accept="image/*,application/pdf,.pdf" onChange={selectFile} />
          </div>
        ) : null}

        {phase === 'review' && review ? (
          <ReceiptScanReview
            review={review}
            categories={categories}
            imageUrl={imageUrl}
            rotation={rotation}
            saving={saving}
            error={error}
            diagnosticOcrText={diagnosticOcrText}
            diagnosticOcrMeta={diagnosticOcrMeta}
            diagnosticOcrQuality={diagnosticOcrQuality}
            onChange={(next) => { setReview(next); setDirty(true); }}
            onRotate={rotate}
            onRerun={() => file && void runOcr(file, rotation)}
            onCancel={closeFlow}
            onSave={saveDraft}
          />
        ) : null}
      </section>
    </div>
  );
}
