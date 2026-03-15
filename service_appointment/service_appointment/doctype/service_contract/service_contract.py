# -*- coding: utf-8 -*-
# Copyright (c) 2020, Sayed Hameed Ebrahim and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe

from frappe.utils import add_days, getdate, cint, cstr, flt
from frappe.model.mapper import get_mapped_doc

from frappe import throw, _
from frappe.model.document import Document

class ServiceContract(Document):
	@frappe.whitelist()
	def generate_schedule(self):
		self.set('visits_schedule', [])
		
		self.validate_maintenance_detail()
		s_list = []
		s_list = self.create_schedule_list(self.start_date, self.end_date, self.no_of_visits)

		total_price = 0
		for item in self.contract_services:
			total_price += item.rate

		self.total_price = total_price

		amount = self.total_price / self.no_of_visits
		remaining = self.total_price

		for i in range(1, self.no_of_visits + 1):
			child = self.append('visits_schedule')
			child.date = s_list[i-1].strftime('%Y-%m-%d')
			child.idx = i
			child.amount = flt(amount, 3)
			if i == self.no_of_visits:
				child.amount = flt(remaining, 3)
				remaining -= flt(remaining, 3)
			else:
				remaining -= flt(amount, 3)
		self.save()

	@frappe.whitelist()
	def regenerate_schedule(self):
		self.validate_maintenance_detail()
		s_list = []
		s_list = self.create_schedule_list(self.start_date, self.end_date, self.no_of_visits)

		for visit in self.visits_schedule:
			if visit.status != 'Completed':
				visit_date = s_list[visit.idx-1].strftime('%Y-%m-%d')
				frappe.db.set_value('Service Appointment', visit.service_appointment, 'date', visit_date)
				frappe.db.set_value('Service Appointment', visit.service_appointment, 'time', 0)
				frappe.db.set_value('Service Appointment', visit.service_appointment, 'appointment_status', '')
				visit.date = visit_date
		
		self.save()


	def validate_maintenance_detail(self):
		if not self.get('contract_services'):
			throw(_("Please enter Contract Services"))

		if not self.start_date or not self.end_date:
			throw(_("Please select Start Date and End Date"))
		elif not self.no_of_visits:
			throw(_("Please mention no of visits required"))

		if getdate(self.start_date) >= getdate(self.end_date):
			throw(_("Start date should be less than end date"))


	def create_schedule_list(self, start_date, end_date, no_of_visit):
		schedule_list = []
		date_copy = start_date
		date_diff = (getdate(end_date) - getdate(start_date)).days
		add_by = date_diff / no_of_visit

		def diff_month(d1, d2):
			diff = (d1.year - d2.year) * 12 + d1.month - d2.month
			return diff

		for visit in range(cint(no_of_visit)):
			if (getdate(date_copy) < getdate(end_date)):
				#if visit > 0:
				
				if len(schedule_list) < no_of_visit:
					if self.periodicity == 'Monthly' and int(diff_month(getdate(end_date), getdate(start_date)))+1 == no_of_visit:
						date_copy = frappe.utils.add_months(start_date, visit)
						schedule_date = getdate(date_copy)
					elif self.periodicity == 'Weekly' and int(date_diff(getdate(end_date), getdate(start_date)).day/7) == no_of_visit:
						date_copy = frappe.utils.add_to_date(start_date, weeks=visit)
						schedule_date = getdate(date_copy)
					elif self.periodicity == 'Yearly' and int(diff_month(getdate(end_date), getdate(start_date))) == no_of_visit:
						date_copy = frappe.utils.add_to_date(start_date, years=visit)
						schedule_date = getdate(date_copy)
					elif self.periodicity == 'Quarterly' and int(diff_month(getdate(end_date), getdate(start_date))/4) == no_of_visit:
						date_copy = frappe.utils.add_to_date(start_date, months=visit*4)
						schedule_date = getdate(date_copy)
					elif self.periodicity == 'Half Yearly' and int(diff_month(getdate(end_date), getdate(start_date))/2) == no_of_visit:
						date_copy = frappe.utils.add_to_date(start_date, months=visit*2)
						schedule_date = getdate(date_copy)
					else:
						date_copy = add_days(start_date, add_by*visit)
						schedule_date = getdate(date_copy)

					if schedule_date > getdate(end_date):
						schedule_date = getdate(end_date)
					schedule_list.append(schedule_date)

		return schedule_list

	def validate(self):
		if self.contract_status != 'Terminated':
			now = frappe.utils.getdate(frappe.utils.nowdate())
			if now >= frappe.utils.getdate(self.start_date) and now <= frappe.utils.getdate(self.end_date):
				self.contract_status = "Active"
			elif now < frappe.utils.getdate(self.start_date):
				self.contract_status = "Inactive"
			elif now > frappe.utils.getdate(self.end_date):
				self.contract_status = "Expired"

		self.validate_extra_visits()

	def on_update_after_submit(self):
		self.validate_extra_visits()

	def validate_extra_visits(self):
		for visit in self.extra_visits:
			if not visit.service_appointment:
				doc = frappe.new_doc('Service Appointment')
				doc.status = 'Draft'
				doc.appointment_status = ''
				doc.time = ''
				doc.duration = ''
				doc.customer = self.customer
				doc.customer_address = self.customer_address
				doc.address_display = self.address_display
				doc.location = self.location
				for item in self.contract_services:
					row = doc.append('items')
					row.item = item.item
					row.rate = visit.amount if visit.amount else 0
				
				doc.total_amount = 0
				doc.collect_amount = 'Yes' if self.customer_type == 'Cash' else 'No'

				doc.date = visit.date
				doc.service_type = 'One Time' if visit.amount else 'Contract'
				doc.service_contract = self.name
				doc.save()

				frappe.db.set_value('Service Contract Visit', visit.name, 'service_appointment', doc.name)

	def on_submit(self):
		for visit in self.visits_schedule:
			doc = frappe.new_doc('Service Appointment')
			doc.status = 'Draft'
			doc.appointment_status = ''
			doc.time = ''
			doc.duration = ''
			doc.customer = self.customer
			doc.customer_address = self.customer_address
			doc.address_display = self.address_display
			doc.location = self.location
			doc.sales_person = self.sales_person
			child = doc.append('pest_type', {})
			child.pest_type = self.pest_type
			for item in self.contract_services:
				row = doc.append('items')
				row.item = item.item
				row.rate = item.rate / self.no_of_visits if item.rate else 0
			
			doc.total_amount = visit.amount
			doc.collect_amount = 'Yes' if self.customer_type == 'Cash' else 'No'

			doc.date = visit.date
			doc.appointment_order = str(visit.idx) + '/' + str(self.no_of_visits)
			doc.service_type = 'Contract'
			doc.service_contract = self.name
			template = frappe.get_all("Service Contract Template Item", fields=['description'], filters=[{'parent': self.service_contract_template}, {'idx': visit.idx}])
			if template:
				doc.visit_details = template[0].description or ""
			doc.save()

			frappe.db.set_value('Service Contract Visit', visit.name, 'service_appointment', doc.name)

	def on_cancel(self):
		for visit in self.visits_schedule:
			if frappe.db.get_value('Service Appointment', visit.service_appointment, 'docstatus') != 1:
				frappe.db.set_value('Service Contract Visit', visit.name, 'service_appointment', '')
				frappe.db.set_value('Service Contract Visit', visit.name, 'status', '')
				frappe.db.set_value('Service Appointment', visit.service_appointment, 'service_contract', '')
				frappe.delete_doc('Service Appointment', visit.service_appointment)
	
	@frappe.whitelist()
	def terminate_contract(self, delete_draft=False):
		if delete_draft:
			for visit in self.visits_schedule:
				if frappe.db.get_value('Service Appointment', visit.service_appointment, 'docstatus') != 1:
					frappe.db.set_value('Service Contract Visit', visit.name, 'service_appointment', '')
					frappe.db.set_value('Service Contract Visit', visit.name, 'status', '')
					frappe.delete_doc('Service Appointment', visit.service_appointment)
		
		frappe.db.set_value('Service Contract', self.name, 'contract_status', 'Terminated')
		frappe.msgprint('Service Contract has been terminated successfully')

	@frappe.whitelist()
	def link_visit_schedules(self):
		for visit in self.visits_schedule:
			sas = frappe.get_all("Service Appointment", filters={"service_contract": self.name, "date": visit.date})
			if sas:
				visit.service_appointment = sas[0].name

		self.save()

@frappe.whitelist()
def make_invoice(source_name, target_doc=None, ignore_permissions=False):
	def postprocess(source, target):
		target.items = []
		for visit in source.visits_schedule:
			service_appointment = frappe.get_doc("Service Appointment", visit.service_appointment)
		
			for fee in service_appointment.items:
				if (fee.rate - fee.invoiced_amount) > 0 or (fee.rate < 0 and fee.rate - fee.invoiced_amount < 0):
					item = target.append("items")
					item.item_code = fee.item
					item.qty = 1
					item.rate = fee.rate - fee.invoiced_amount
					item.service_appointment = service_appointment.name
					item.service_appointment_item = fee.name
					item.description = 'Visit ' + str(visit.idx) + '/' + str(source.no_of_visits) #+ ' On ' + str(visit.date)
		if not target.items:
			frappe.throw('All appointments invoices have been already generated')
		target.group_same_items = 1
		target.allocate_advances_automatically = 1
		target.run_method("set_missing_values")
		target.run_method("set_taxes")
		target.run_method("calculate_taxes_and_totals")

	doclist = get_mapped_doc("Service Contract", source_name, {
		"Service Contract": {
			"doctype": "Sales Invoice",
		}
	}, target_doc, postprocess, ignore_permissions=ignore_permissions)

	return doclist

@frappe.whitelist()
def renew(source_name, target_doc=None, ignore_permissions=False):
	def postprocess(source, target):
		target.visits_schedule = []
		target.extra_visits = []
		target.start_date = frappe.utils.add_to_date(source.end_date, days=1)
		target.end_date = frappe.utils.add_to_date(target.start_date, days=frappe.utils.date_diff(source.end_date, source.start_date))
		target.run_method("generate_schedule")

	doclist = get_mapped_doc("Service Contract", source_name, {
		"Service Contract": {
			"doctype": "Service Contract",
		}
	}, target_doc, postprocess, ignore_permissions=ignore_permissions)

	return doclist
	