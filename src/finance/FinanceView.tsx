import { FinanceDashboardView } from './FinanceDashboardView';

export function FinanceView() {
  return (
    <section className="view-shell finance-view">
      <header className="view-header finance-view-header">
        <div><h1>Finanse</h1></div>
      </header>
      <FinanceDashboardView />
    </section>
  );
}
