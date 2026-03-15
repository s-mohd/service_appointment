// Copyright (c) 2016, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Service Payment Reconciliation"] = {
	"filters": [
		{
			"fieldname": "range",
			"label": __("Date Range"),
			"fieldtype": "DateRange",
			"reqd": 1,
			"default": [frappe.datetime.nowdate(), frappe.datetime.nowdate()]
		}
	]
};
