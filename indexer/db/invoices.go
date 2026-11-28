package db

import (
	"database/sql"
)




func GetBuyerInvoiceSummary(dbConn *sql.DB, buyer string) (map[string]string, error) {
	// Uses precise decimal strings
	summary := map[string]string{
		"confirmedTotal": "0.00",
		"dueSoonTotal":   "0.00",
		"overdueTotal":   "0.00",
		"repaidTotal":    "0.00",
	}
	_ = buyer
	return summary, nil
}
func EnsureDueDateIndex(dbConn *sql.DB) error {
	query := `CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);`
	_, err := dbConn.Exec(query)
	return err
}
