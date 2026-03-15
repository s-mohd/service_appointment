# Copyright (c) 2024, Sayed Hameed Ebrahim and contributors
# For license information, please see license.txt

import copy
import frappe
from frappe.utils import cint, date_diff, getdate


def execute(filters=None):
	columns, data = get_columns(), get_data(filters)
	return columns, data

def get_data(filters):
	data = []
	technicians = frappe._dict()
	technician_appointments = frappe._dict()

	commission_amt = filters.get("commission_amount")
	complaint_amt = filters.get("complaint_amount")
	filters = {"date": ["between", [filters.get("from_date"), filters.get("to_date")]], "appointment_status": "Completed", "docstatus": 1}
	sas = frappe.get_all("Service Appointment", filters=filters, fields=["name"])
	for sa in sas:
		sa = frappe.get_doc("Service Appointment", sa.name)
		related_to = copy.deepcopy(sa.related_to)
		related_to_date = copy.deepcopy(sa.date)
		related_to_name = copy.deepcopy(sa.name)
		is_complaint = False
		techs = [sa.completed_by]
		for member in sa.other_members:
			techs.append(member.member_name)
		per_tech_amt = commission_amt / len(techs)
		for tech in techs:
			if tech not in technicians.keys():
				technicians[tech] = frappe._dict({
					"technician": tech,
					"completed_service_qty": 1 if not is_complaint else 0,
					"commission_amount": per_tech_amt if not is_complaint else 0,
					"complaint_service_qty": 1 if is_complaint else 0,
					"complaint_amount": complaint_amt if is_complaint else 0,
				})
			else:
				technicians[tech].completed_service_qty += 1 if not is_complaint else 0
				technicians[tech].commission_amount += per_tech_amt if not is_complaint else 0
				technicians[tech].complaint_service_qty += 1 if is_complaint else 0
				technicians[tech].complaint_amount += complaint_amt if is_complaint else 0

			sa.set("completed_service_qty", 1 if not is_complaint else 0)
			sa.set("commission_amount", per_tech_amt if not is_complaint else 0)
			sa.set("complaint_service_qty", 1 if is_complaint else 0)
			sa.set("complaint_amount", complaint_amt if is_complaint else 0)
   
			sa.set("related_to_date", "")
			sa.set("related_to", "")
    
			technician_appointments.setdefault(tech, []).append(sa)
    
		is_complaint = True if sa.service_type in ["Complaint", "Contract Complaint"] else False
		if is_complaint and related_to:
			original_sa = frappe.get_doc("Service Appointment", related_to)
			if not cint(filters.get("max_complaint_date_before")) or (
				filters.get("max_complaint_date_before") and date_diff(getdate(related_to_date), getdate(original_sa.date)) <= cint(filters.get("max_complaint_date_before"))
			):
				techs = [original_sa.completed_by]
				for member in original_sa.other_members:
					techs.append(member.member_name)
				per_tech_amt = complaint_amt / len(techs)
				for tech in techs:
					if tech not in technicians.keys():
						technicians[tech] = frappe._dict({
							"technician": tech,
							"completed_service_qty": 1 if not is_complaint else 0,
							"commission_amount": per_tech_amt if not is_complaint else 0,
							"complaint_service_qty": 1 if is_complaint else 0,
							"complaint_amount": per_tech_amt if is_complaint else 0,
						})
					else:
						technicians[tech].completed_service_qty += 1 if not is_complaint else 0
						technicians[tech].commission_amount += per_tech_amt if not is_complaint else 0
						technicians[tech].complaint_service_qty += 1 if is_complaint else 0
						technicians[tech].complaint_amount += per_tech_amt if is_complaint else 0

					original_sa.set("completed_service_qty", 1 if not is_complaint else 0)
					original_sa.set("commission_amount", per_tech_amt if not is_complaint else 0)
					original_sa.set("complaint_service_qty", 1 if is_complaint else 0)
					original_sa.set("complaint_amount", per_tech_amt if is_complaint else 0)
		
					original_sa.set("related_to_date", original_sa.date)
					original_sa.set("related_to", original_sa.name)
					original_sa.set("date", related_to_date)
					original_sa.set("name", related_to_name)

					technician_appointments.setdefault(tech, []).append(original_sa)

    
	for tech in technicians.keys():
		technicians[tech].total_commission = technicians[tech].commission_amount - technicians[tech].complaint_amount
		technicians[tech].indent = 0
		technicians[tech].parent_technician = ""
  
		data.append(technicians[tech])
  
		for sa in technician_appointments[tech]:
			data.append({
				"indent": 1,
				"technician": "",
				"parent_technician": tech,
				"date": sa.date,
				"service_appointment": sa.name,
				"related_to_date": sa.related_to_date,
				"related_to": sa.related_to,
				"service_type": sa.service_type,
				"status": sa.appointment_status,
				"completed_service_qty": sa.completed_service_qty,
				"commission_amount": sa.commission_amount,
				"complaint_service_qty": sa.complaint_service_qty,
				"complaint_amount": sa.complaint_amount,
				"total_commission": sa.commission_amount - sa.complaint_amount
			})
  
  
	return data

def get_columns():
	return [
		{
			"fieldname": "technician",
			"label": "Technician",
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "date",
			"label": "Date",
			"fieldtype": "Date",
			"width": 100
		},
		{
			"fieldname": "service_appointment",
			"label": "Service Appointment",
			"fieldtype": "Link",
			"options": "Service Appointment",
			"width": 150
		},
		{
			"fieldname": "service_type",
			"label": "Service Type",
			"fieldtype": "Data",
			"width": 100
		},
		{
			"fieldname": "related_to_date",
			"label": "Related To Date",
			"fieldtype": "Date",
			"width": 100
		},
		{
			"fieldname": "related_to",
			"label": "Related To",
			"fieldtype": "Link",
			"options": "Service Appointment",
			"width": 150
		},
		{
			"fieldname": "status",
			"label": "Status",
			"fieldtype": "Data",
			"width": 100
		},
		{
			"fieldname": "completed_service_qty",
			"label": "Completed Service Qty",
			"fieldtype": "Int",
			"width": 100
		},
		{
			"fieldname": "commission_amount",
			"label": "Commission Amount",
			"fieldtype": "Currency",
			"width": 150
		},
		{
			"fieldname": "complaint_service_qty",
			"label": "Complaint Service Qty",
			"fieldtype": "Int",
			"width": 100
		},
		{
			"fieldname": "complaint_amount",
			"label": "Complaint Amount",
			"fieldtype": "Currency",
			"width": 150
		},
		{
			"fieldname": "total_commission",
			"label": "Total Commission",
			"fieldtype": "Currency",
			"width": 150
		}
	]
    