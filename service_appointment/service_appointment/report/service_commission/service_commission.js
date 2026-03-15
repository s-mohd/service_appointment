// Copyright (c) 2024, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt

frappe.query_reports["Service Commission"] = {
	"filters": [
		{
			"fieldname":"from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
			"reqd": 1
		},
		{
			"fieldname":"to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1
		},
		{
			"fieldname":"commission_amount",
			"label": __("Commission Amount"),
			"fieldtype": "Currency",
			"default": 1.5
		},
		{
			"fieldname":"complaint_amount",
			"label": __("Complaint Amount"),
			"fieldtype": "Currency",
			"default": 3
		},
		{
			"fieldname":"max_complaint_date_before",
			"label": __("Max Complaint Date Before (Days)"),
			"fieldtype": "Int",
			"default": 90
		}
	],
	"tree": true,
	"initial_depth": 1,
};
