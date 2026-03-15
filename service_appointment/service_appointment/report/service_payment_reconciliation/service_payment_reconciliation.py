# Copyright (c) 2013, Sayed Hameed Ebrahim and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _

def execute(filters=None):
	columns = get_columns(filters=filters)
	data = get_data(filters=filters)

	return columns, data

def get_data(filters=None):
	conditions = ""
	if filters.get("range"):
		conditions += " and sa.`date` >= %s and sa.`date` <= %s" % (frappe.db.escape(filters.get("range")[0]), frappe.db.escape(filters.get("range")[1]))

	out = []

	result = frappe.db.sql("""SELECT sa.`name`, sa.`customer`, sa.`appointment_status`, sa.`date`, sa.`service_type`, emp.`employee_name` as completed_by,
		sa.`mobile_no`, sa.`total_amount`, cust_add.`city`, sa.`received_amount` as service_paid_amount, sa.`mode_of_payment`, sa.`sales_person`
		FROM `tabService Appointment` sa
		LEFT JOIN `tabCustomer` cust ON sa.`customer` = cust.`name`
		LEFT JOIN `tabEmployee` emp ON emp.`name` = sa.`completed_by`
		LEFT JOIN `tabAddress` cust_add ON cust_add.`name` = sa.`customer_address`
		WHERE sa.appointment_status != 'Cancelled'
		{conditions}
		ORDER BY sa.`date`, sa.`time`
	""".format(conditions=conditions), as_dict=1)

	sn = 1
	for row in result:
		invoices = frappe.db.sql("""SELECT si.name as invoice_no, si.status as invoice_status, si.grand_total,
				si.paid_amount
			FROM `tabSales Invoice Item` sii
			LEFT JOIN `tabSales Invoice` si ON si.name = sii.parent
			WHERE sii.service_appointment = '{service_appointment}'
			AND si.docstatus = 1
			GROUP BY si.name
		""".format(service_appointment=row.name), as_dict=1)

		has_invoice = False
		for invoice in invoices:
			has_invoice = True
			references = frappe.db.sql("""SELECT pe.mode_of_payment, SUM(per.allocated_amount) as total_allocated
				FROM `tabPayment Entry Reference` per
				LEFT JOIN `tabPayment Entry` pe ON pe.name = per.parent
				WHERE per.reference_name = '{invoice_no}'
				AND pe.docstatus = 1
				GROUP BY per.reference_name, pe.mode_of_payment
			""".format(invoice_no=invoice.invoice_no), as_dict=1)

			has_payment = False
			for reference in references:
				has_payment = True
				out.append({
					'sn': sn,
					'service_date': row.date,
					'customer_name': row.customer,
					'appointment_status': row.appointment_status,
					'service_type': row.service_type,
					'invoice_no': invoice.invoice_no,
					'invoice_status': invoice.invoice_status,
					'invoice_amount': invoice.grand_total,
					'paid_amount': reference.total_allocated,
					'payment_method': reference.mode_of_payment,
					'completed_by': row.completed_by,
					'sales_person': row.sales_person,
					'total_amount': row.total_amount,
					'area': row.city,
					'mobile_no': row.mobile_no,
					'mode_of_payment': row.mode_of_payment,
					'service_paid_amount': row.service_paid_amount
				})
			
			if not has_payment:
				out.append({
					'sn': sn,
					'service_date': row.date,
					'customer_name': row.customer,
					'appointment_status': row.appointment_status,
					'service_type': row.service_type,
					'invoice_no': invoice.invoice_no,
					'invoice_status': invoice.invoice_status,
					'invoice_amount': invoice.grand_total,
					'paid_amount': invoice.paid_amount,
					'payment_method': '',
					'completed_by': row.completed_by,
					'sales_person': row.sales_person,
					'total_amount': row.total_amount,
					'area': row.city,
					'mobile_no': row.mobile_no,
					'mode_of_payment': row.mode_of_payment,
					'service_paid_amount': row.service_paid_amount
				})

		if not has_invoice:
			out.append({
				'sn': sn,
				'service_date': row.date,
				'customer_name': row.customer,
				'appointment_status': row.appointment_status,
				'service_type': row.service_type,
				'invoice_no': '',
				'invoice_status': '',
				'invoice_amount': '',
				'paid_amount': '',
				'payment_method': '',
				'completed_by': row.completed_by,
				'sales_person': row.sales_person,
				'total_amount': row.total_amount,
				'area': row.city,
				'mobile_no': row.mobile_no,
				'mode_of_payment': row.mode_of_payment,
				'service_paid_amount': row.service_paid_amount
			})
		
		sn += 1
	
	return out

def get_columns(filters=None):
	columns = [
		{
			"fieldname": "sn",
			"label": _("SN"),
			"fieldtype": "Data",
			"width": 50
		},
		{
			"fieldname": "service_date",
			"label": _("Service Date"),
			"fieldtype": "Date",
			"width": 100
		},
		{
			"fieldname": "customer_name",
			"label": _("Customer Name"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "mobile_no",
			"label": _("Mobile No."),
			"fieldtype": "Data",
			"width": 100
		},
		{
			"fieldname": "area",
			"label": _("Area"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "appointment_status",
			"label": _("Appointment Status"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "service_type",
			"label": _("Service Type"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "total_amount",
			"label": _("Service Amount"),
			"fieldtype": "Currency",
			"width": 150
		},
		{
			"fieldname": "service_paid_amount",
			"label": _("Received Amount"),
			"fieldtype": "Currency",
			"width": 150
		},
		{
			"fieldname": "mode_of_payment",
			"label": _("Mode of Payment"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "invoice_status",
			"label": _("Invoice Status"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "invoice_amount",
			"label": _("Invocie Amount"),
			"fieldtype": "Currency",
			"width": 150
		},
		{
			"fieldname": "paid_amount",
			"label": _("Paid Amount"),
			"fieldtype": "Currency",
			"width": 150
		},
		{
			"fieldname": "payment_method",
			"label": _("Payment Method"),
			"fieldtype": "Data",
			"width": 150
		},
		{
			"fieldname": "completed_by",
			"label": _("Completed By"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "sales_person",
			"label": _("Sales Person"),
			"fieldtype": "Link",
			"options": "Sales Person",
			"width": 200
		}
	]

	return columns