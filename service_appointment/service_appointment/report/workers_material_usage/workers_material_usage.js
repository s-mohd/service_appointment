// Copyright (c) 2016, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Workers Material Usage"] = {
	"filters": [
		{
			"fieldname": "employee",
			"label": __("Employee"),
			"fieldtype": "Link",
			"options": "Employee"
		},
		{
			"fieldname": "range",
			"label": __("Date Range"),
			"fieldtype": "DateRange",
			"reqd": 1,
			"default": [frappe.datetime.nowdate(), frappe.datetime.nowdate()]
		}
	]
};
