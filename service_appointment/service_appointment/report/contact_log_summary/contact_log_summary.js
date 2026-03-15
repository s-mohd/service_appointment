// Copyright (c) 2025, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt

frappe.query_reports["Contact Log Summary"] = {
	"filters": [
		{
			"fieldname": "from_date",
			"label": "From Date",
			"fieldtype": "Date",
			"default": frappe.datetime.month_start(),
			"reqd": 1
		},
		{
			"fieldname": "to_date",
			"label": "To Date",
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1
		},
		{
			"fieldname": "group_by",
			"label": "Group By",
			"fieldtype": "Select",
			"options": "Reason\nChannel",
			"default": "Reason",
			"reqd": 1
		},
	],
	"tree": true,
	"initial_depth": 1,
};
