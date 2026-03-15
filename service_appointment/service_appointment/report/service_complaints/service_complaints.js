// Copyright (c) 2016, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Service Complaints"] = {
	"filters": [
		{
			"fieldname": "range",
			"label": __("Complaint Date"),
			"fieldtype": "DateRange",
			"reqd": 1,
			"default": [frappe.datetime.month_start(), frappe.datetime.month_end()]
		},
		{
			"fieldname": "service_date",
			"label": __("Service Date"),
			"fieldtype": "DateRange"
		}
	]
};
