// Copyright (c) 2016, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Service Appointment"] = {
	"filters": [
		{
			"fieldname": "date",
			"label": __("Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today()
		}
	]
};
