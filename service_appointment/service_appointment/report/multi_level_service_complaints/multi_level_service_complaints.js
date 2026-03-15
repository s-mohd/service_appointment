// Copyright (c) 2022, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Multi-level Service Complaints"] = {
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
	],
	"formatter": function (value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (typeof data !== "undefined") {
			if (["customer_name", "mobile_no", "area", "service_date", "service_type", "pest_type", "service_amount", "appointment_status", "completed_by", "appointment_other_members", "items"].includes(column["fieldname"])) {
				value = `<span style='color:green!important;'>${value}</span>`;
			}

			if (["complaint_date", "complaint_appointment_status", "complaint_completed_by", "complaint_completed_by_om", "complaint_items", "complaint_pest_type"].includes(column["fieldname"])) {
				value = `<span style='color:orange!important;'>${value}</span>`;
			}

			if (["complaint_date2", "complaint_appointment_status2", "complaint_completed_by2", "complaint_completed_by_om2", "complaint_items2", "complaint_pest_type2"].includes(column["fieldname"])) {
				value = `<span style='color:red!important;'>${value}</span>`;
			}
		}

		return value;
	}
};
