# -*- coding: utf-8 -*-
# Copyright (c) 2020, Sayed Hameed Ebrahim and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
import json
from frappe.core.utils import get_parent_doc
from frappe.utils import getdate, get_time, flt, get_url, cint
from frappe.model.mapper import get_mapped_doc
from frappe import _
import datetime
from pprint import pprint
import functools

from frappe.utils.data import get_date_str


class ServiceAppointment(Document):
	@frappe.whitelist()
	def check_permission_of_service(self):
		user = frappe.get_doc('User', frappe.session.user)
		user_roles = [r[0] for r in frappe.db.sql("""select role from `tabHas Role`
				where parent=%s and role not in ('All', 'Guest')""", (user.name))] + ['All', 'Guest']
		
		if 'Service Team' in user_roles:
			return True
		else:
			return False

	@frappe.whitelist()
	def get_service_report_link(self):
		"""Returns public link for the attachment via `templates/emails/print_link.html`."""
		return frappe.get_template("templates/emails/print_link.html").render({
			"url": get_url(),
			"doctype": self.doctype,
			"name": self.name,
			"print_format": 'Service Appointment',
			"key": frappe.get_doc('Service Appointment', self.name).get_signature()
		})

	@frappe.whitelist()
	def complete_appointment(self, appointment_status=None, mode_of_payment=None, received_amount=None, used_materials=None, start_time=None, end_time=None, actual_duration=None, customer_name=None, customer_mobile=None, signature=None, remarks=None, attachment=None, completed_by=None, other_members=None, reason_of_incompletion=None):
		_apply_complete_appointment(
			self,
			appointment_status=appointment_status,
			mode_of_payment=mode_of_payment,
			received_amount=received_amount,
			used_materials=used_materials,
			start_time=start_time,
			end_time=end_time,
			actual_duration=actual_duration,
			customer_name=customer_name,
			customer_mobile=customer_mobile,
			signature=signature,
			remarks=remarks,
			attachment=attachment,
			completed_by=completed_by,
			other_members=other_members,
			reason_of_incompletion=reason_of_incompletion,
		)

	def validate(self):
		if self.service_type in ['Contract', 'Contract Complaint', 'Complaint', 'Disinfection'] or (self.items and self.items[0].item == 'Disinfection - Sanitizing'):
				self.guarantee_qty = 0
				self.expiry_date = ''

	def on_submit(self):
		if not self.appointment_status or self.appointment_status in ('Scheduled', 'In Progress'):
			frappe.throw("Please complete appointment before submit")

		total_fees = 0
		for item in self.items:
			total_fees += flt(item.rate, 3) - flt(item.invoiced_amount, 3)

		if total_fees > 0:
			#make_invoice(self.name)
			sales_invoice = frappe.new_doc('Sales Invoice')
			sales_invoice.customer = self.customer
			sales_invoice.customer_address = self.customer_address
			sales_invoice.contact_person = self.contact_person
			sales_invoice.flags.ignore_permissions = 1
			sales_invoice.service_type = self.service_type
			sales_invoice.allocate_advances_automatically = 1

			sales_invoice.items = []
			for fee in self.items:
				if (fee.rate - fee.invoiced_amount) > 0 or (fee.rate < 0 and fee.rate - fee.invoiced_amount < 0):
					item = sales_invoice.append("items")
					item.item_code = fee.item
					item.qty = 1
					item.rate = fee.rate - fee.invoiced_amount
					item.service_appointment = self.name
					item.service_appointment_item = fee.name

			sales_invoice.run_method("set_missing_values")
			sales_invoice.run_method("set_taxes")
			sales_invoice.run_method("calculate_taxes_and_totals")

			sales_invoice.save()
			sales_invoice.submit()

			update_invoiced_amount(sales_invoice=sales_invoice.name)

		if not self.get('completed_by'):
			frappe.throw('Login user is not assigned to employee')

		if self.used_materials:
			employee_meta = frappe.get_meta('Employee')
			warehouse_field = next(
				(fieldname for fieldname in ('warehouse', 'default_warehouse', 'employee_warehouse') if employee_meta.has_field(fieldname)),
				None
			)
			if not warehouse_field:
				frappe.throw(_('Employee warehouse field is not configured on Employee doctype.'))

			warehouse = frappe.db.get_value('Employee', self.completed_by, warehouse_field)
			if not warehouse:
				frappe.throw(_('Employee does not have a warehouse configured.'))

			material_issue = frappe.new_doc("Stock Entry")
			material_issue.stock_entry_type = "Material Issue"
			material_issue.posting_date = self.get("date")
			material_issue.service_appointment = self.name
			for issue_item in self.used_materials:
				if issue_item.item:
					if frappe.get_value('Item', issue_item.item, 'is_stock_item'):
						material_issue_item = material_issue.append("items")
						material_issue_item.s_warehouse = warehouse
						material_issue_item.item_code = issue_item.item
						material_issue_item.qty = issue_item.qty
						material_issue_item.uom = issue_item.uom
						material_issue_item.allow_zero_valuation_rate = 1

			if material_issue.get('items'):
				material_issue.flags.ignore_permissions = 1
				material_issue.save()
				material_issue.submit()

		if self.service_contract:
			frappe.db.sql("""UPDATE `tabService Contract Visit`
			SET `status` = '{appointment_status}',
			`last_status_date` = '{date}'
			WHERE `service_appointment` = '{service_appointment}'
			""".format(appointment_status=self.appointment_status, date=getdate(), service_appointment=self.name))

		return 'success'

	def on_cancel(self):
		if self.service_contract:
			self.ignore_linked_doctypes = ['Service Contract', 'Service Contract Visit']
			visit_name = frappe.db.get_value('Service Contract Visit', filters={'service_appointment': self.name}, fieldname='name')
			frappe.db.set_value('Service Contract Visit', visit_name, 'service_appointment', '')
			frappe.db.set_value('Service Contract Visit', visit_name, 'status', '')
			# frappe.db.set_value('Service Contract Visit', visit_name, 'last_status_date', '')
			frappe.db.set_value('Service Contract Visit', visit_name, 'payment_status', '')
			frappe.db.set_value('Service Appointment', self.name, 'service_contract', '')
			for si_item in frappe.db.get_all('Sales Invoice Item', filters={'service_appointment': self.name, 'docstatus': 2}, fields=['name']):
				frappe.db.sql("""UPDATE `tabSales Invoice Item` SET `service_appointment` = '' WHERE `name` = %s """, (si_item.name))

	def on_trash(self):
		for si_item in frappe.db.get_all('Sales Invoice Item', filters={'service_appointment': self.name, 'docstatus': 2}, fields=['name']):
			frappe.db.sql("""UPDATE `tabSales Invoice Item` SET `service_appointment` = '' WHERE `name` = %s """, (si_item.name))
		
		if self.service_contract:
			visit_name = frappe.db.get_value('Service Contract Visit', filters={'service_appointment': self.name}, fieldname='name')
			frappe.db.set_value('Service Contract Visit', visit_name, 'service_appointment', '')
			frappe.db.set_value('Service Contract Visit', visit_name, 'status', '')
			frappe.db.set_value('Service Contract Visit', visit_name, 'last_status_date', '')
			frappe.db.set_value('Service Contract Visit', visit_name, 'payment_status', '')
			frappe.db.set_value('Service Appointment', self.name, 'service_contract', '')
			for si_item in frappe.db.get_all('Sales Invoice Item', filters={'service_appointment': self.name, 'docstatus': 2}, fields=['name']):
				frappe.db.sql("""UPDATE `tabSales Invoice Item` SET `service_appointment` = '' WHERE `name` = %s """, (si_item.name))

	@frappe.whitelist()
	def check_customer_balance(self):
		from erpnext.accounts.utils import get_balance_on
		balance = get_balance_on(party_type='Customer', party=self.customer)
		balance = flt(balance) * -1
		has_balance = False
		if balance >= self.total_amount:
			has_balance = True

		return {'has_balance': has_balance, 'balance': balance}

	@frappe.whitelist()
	def get_payment_status(self):
		sales_invoice = frappe.db.sql("""SELECT si.status
			FROM `tabSales Invoice` si, `tabSales Invoice Item` sii
			WHERE sii.`parent` = si.`name`
			AND sii.service_appointment = %(service_appointment)s
			AND si.docstatus != 2
			ORDER BY si.creation desc
			LIMIT 1
		""", {'service_appointment':self.name}, as_dict=1)
		
		if sales_invoice:
			return sales_invoice[0].status

		return False


def _apply_complete_appointment(
	doc,
	appointment_status=None,
	mode_of_payment=None,
	received_amount=None,
	used_materials=None,
	start_time=None,
	end_time=None,
	actual_duration=None,
	customer_name=None,
	customer_mobile=None,
	signature=None,
	remarks=None,
	attachment=None,
	completed_by=None,
	other_members=None,
	reason_of_incompletion=None,
):
	used_materials = used_materials or []
	other_members = other_members or []

	doc.appointment_status = appointment_status
	doc.mode_of_payment = mode_of_payment
	doc.received_amount = received_amount
	doc.set('used_materials', [])
	for row in used_materials:
		new_item = doc.append('used_materials')
		new_item.item = row['item']
		new_item.uom = row['uom']
		new_item.qty = row['qty']

	doc.start_time = start_time
	doc.end_time = end_time
	doc.actual_duration = actual_duration
	doc.customer_name = customer_name
	doc.customer_mobile = customer_mobile
	doc.signature = signature
	doc.remarks = remarks
	doc.attachment = attachment
	doc.completed_by = completed_by
	doc.reason_of_incompletion = reason_of_incompletion

	doc.set('other_members', [])
	for member in other_members:
		if 'employee' in member:
			new_member = doc.append('other_members')
			new_member.member_name = member['employee']

	if doc.service_contract:
		frappe.db.sql("""UPDATE `tabService Contract Visit`
		SET `status` = '{appointment_status}',
		`last_status_date` = '{date}'
		WHERE `service_appointment` = '{service_appointment}'
		""".format(appointment_status=doc.appointment_status, date=getdate(), service_appointment=doc.name))

	if appointment_status == 'Cancelled':
		doc.docstatus = 2
		doc.status = 'Cancelled'
	else:
		doc.submit()


@frappe.whitelist()
def check_inspection(customer, customer_address, date, time):
	last_customer_appointment = frappe.db.sql("""SELECT sa.name
		FROM `tabService Appointment` sa
		WHERE sa.customer = '{customer}'
		AND sa.customer_address = '{customer_address}'
		AND (sa.date < '{date}'
		OR (sa.date = '{second_date}' AND CAST('{second_time}' AS time) >= sa.time))
		ORDER BY sa.date DESC
		LIMIT 1
	""".format(customer=customer, customer_address=customer_address, date=date, second_date=date, second_time=time), as_dict=1)

	if last_customer_appointment:
		last_appointment = frappe.get_doc('Service Appointment', last_customer_appointment[0].name)
		for item in last_appointment.items:
			if item.item == 'Inspection' and item.rate > 0:
				return frappe._dict({
					'service_appointment_name': last_appointment.name,
					'date': last_appointment.name,
					'rate': item.rate,
					'invoiced_amount_value': item.invoiced_amount,
					'invoiced_amount': frappe.format(item.invoiced_amount, dict(fieldtype='Currency'))
				})

	return []

@frappe.whitelist()
def get_availability_data(date, team=None):
	"""
	Get availability data of 'team' on 'date'
	:param date: Date to check in schedule
	:param team: Name of the team
	:return: dict containing a list of available slots, list of appointments and time of appointments
	"""

	date = getdate(date)
	weekday = date.strftime('%A')

	#check_employee_wise_availability(date, team_doc)

	slot_details = get_available_slots(date, team)

	if not slot_details:
		# TODO: return available slots in nearby dates
		frappe.throw(_('No teams available on {0}').format(date), title=_('Not Available'))

	return {'slot_details': slot_details}


def check_employee_wise_availability(date, team_doc):
	employee = None
	if team_doc.employee:
		employee = team_doc.employee
	elif team_doc.user_id:
		employee = frappe.db.get_value('Employee', {'user_id': practitioner_doc.user_id}, 'name')

	if employee:
		# check holiday
		if is_holiday(employee, date):
			frappe.throw(_('{0} is a holiday'.format(date)), title=_('Not Available'))

		# check leave status
		leave_record = frappe.db.sql("""select half_day from `tabLeave Application`
			where employee = %s and %s between from_date and to_date
			and docstatus = 1""", (employee, date), as_dict=True)
		if leave_record:
			if leave_record[0].half_day:
				frappe.throw(_('{0} is on a Half day Leave on {1}').format(practitioner_doc.name, date), title=_('Not Available'))
			else:
				frappe.throw(_('{0} is on Leave on {1}').format(practitioner_doc.name, date), title=_('Not Available'))


def get_available_slots(date, team=None):
	available_slots = []
	slot_details = []
	weekday = date.strftime('%A')
	teams = []

	if team:
		team_doc = frappe.get_doc('Team', team)

		if not frappe.db.exists({'doctype': 'Service Team Availability', 'date': date, 'team':team}):
			frappe.throw(_('{0} does not have a Schedule. Add it in Service Team Availability').format(
				frappe.bold(team)), title=_('Team Schedule Not Found'))
				
		team = team_doc.name
		teams.append(team_doc)
	else:
		teams = frappe.get_all('Team')

	for team in teams:
		team_doc = frappe.get_doc('Team', team.name)

		if frappe.db.exists({'doctype': 'Service Team Availability', 'date': date, 'team': team.name}):
			available_slots = []
			team_schedule = frappe.get_all('Service Team Availability', fields='*', filters=[{'date': date}, {'team': team.name}])
			for i in range(24):
				hour_str = "{:02d}".format(i)
				if team_schedule[0]['hour_'+hour_str]:
					available_slots.append({
						'from_time': hour_str + ':00:00',
						'to_time': "{:02d}".format(i+1) + ':00:00'
					})

			if available_slots:
				appointments = []
				# fetch all appointments to practitioner by service unit
				filters = {
					'team': team_doc.name,
					'date': date,
					'status': ['not in',['Cancelled']]
				}

				slot_name = team_doc.name
				# fetch all appointments to practitioner without service unit
				filters['team'] = team_doc.name

				appointments = frappe.db.sql("""SELECT sa.name, sa.time, sa.duration, sa.status, sa.appointment_status, addres.city
				FROM `tabService Appointment` sa
				LEFT JOIN `tabAddress` addres ON addres.name = sa.customer_address
				WHERE sa.team = %(team)s
				AND sa.date = %(date)s
				AND sa.docstatus != 2
				""", ({'team': team_doc.name, 'date': date}), as_dict=1)

				slot_details.append({'slot_name':slot_name, 'avail_slot':available_slots, 'appointments': appointments})

	return slot_details

@frappe.whitelist()
def get_events(start, end, filters=None):
	"""Returns events for Gantt / Calendar view rendering.

	:param start: Start date-time.
	:param end: End date-time.
	:param filters: Filters (JSON).
	"""
	from frappe.desk.calendar import get_event_conditions
	conditions = get_event_conditions('Service Appointment', filters)

	data = frappe.db.sql("""SELECT
			`tabService Appointment`.name, `tabService Appointment`.customer,
			`tabService Appointment`.team, `tabService Appointment`.appointment_status,
			`tabService Appointment`.duration, `tabService Appointment`.service_type,
			timestamp(`tabService Appointment`.date, `tabService Appointment`.time) as 'start',
			`tabService Type`.color,
			`tabAddress`.city, `tabCustomer`.mobile_no
		FROM
			`tabService Appointment`
		LEFT JOIN `tabService Type` ON `tabService Appointment`.service_type = `tabService Type`.`name`
		LEFT JOIN `tabAddress` ON `tabService Appointment`.`customer_address` =`tabAddress`.`name`
		LEFT JOIN `tabCustomer` ON `tabCustomer`.name = `tabService Appointment`.customer
		WHERE
			(`tabService Appointment`.date between %(start)s and %(end)s)
			AND `tabService Appointment`.appointment_status != 'Cancelled' 
			AND `tabService Appointment`.docstatus < 2 
			AND `tabService Appointment`.duration > 0
			{conditions}""".format(conditions=conditions), {"start": start, "end": end}, as_dict=True, update={"allDay": 0})

	for item in data:
		if item.start:
			item.end = item.start + datetime.timedelta(minutes = item.duration)
		item.team = ("{0} ({1})".format(item.customer, item.city)) if item.city else item.customer

		info = []
		if item.service_type:
			info.append(str(item.service_type))
		if item.team:
			info.append(str(item.team))
		if item.mobile_no:
			info.append(str(item.mobile_no))

		item.title = "\n".join(info)

	return data

@frappe.whitelist()
def on_sales_order_save(doc, method):
	#pprint(doc)
	#doc = frappe._dict(eval(doc))
	service_appointments = []
	for item in doc.items:
		if item.get('team'):
			item_time = item.time
			if type(item_time) != datetime.timedelta:
				t = datetime.datetime.strptime(str(item.time),"%H:%M:%S")
				item_time = datetime.timedelta(hours=t.hour, minutes=t.minute, seconds=t.second)

			filters = {
				'team': item.team,
				'date': item.delivery_date,
				'status': ['not in',['Cancelled']]
			}
			appointments = frappe.get_all(
				'Service Appointment',
				filters=filters,
				fields=['name', 'time', 'duration', 'status'])

			appointments_count = 0;
			for booked in appointments:
				booked_moment = booked.time
				end_time_minutes = ((booked_moment.seconds//60) + booked.duration)
				end_time = frappe.utils.datetime.timedelta(minutes=end_time_minutes)

				if (item_time >= booked_moment and item_time <= end_time):
					appointments_count += 1

			if appointments_count > 1:
				frappe.throw("Appointment Time already reserved, please resechedule Item #" + str(item.idx))
			else:
				new_appointment = None
				if item.get('service_appointment'):
					new_appointment = frappe.get_doc('Service Appointment', item.service_appointment)
				else:
					new_appointment = frappe.new_doc('Service Appointment')
					new_appointment.start_time = 0
					new_appointment.end_time = 0
					new_appointment.appointment_status = 'Scheduled'

				new_appointment.team = item.team
				new_appointment.date = item.delivery_date
				new_appointment.duration = item.duration
				new_appointment.time = item.time
				new_appointment.customer = doc.customer
				new_appointment.address = doc.customer_address
				new_appointment.address_display = doc.address_display
				new_appointment.sales_order = doc.name
				new_appointment.sales_order_item = item.name

				new_appointment.service_type = doc.service_type
				new_appointment.pest_type = doc.pest_type
				new_appointment.service_area_json = doc.service_area_json

				new_appointment.save()
				item.service_appointment = new_appointment.name


@frappe.whitelist()
def cancel_appointment(item, service_appointment):
	frappe.delete_doc('Service Appointment', name=service_appointment, force=1)
	frappe.db.set_value("Sales Order Item", item, 'service_appointment', "")
	frappe.db.set_value("Sales Order Item", item, 'team', "")
	frappe.db.set_value("Sales Order Item", item, 'time', "0")
	frappe.db.set_value("Sales Order Item", item, 'duration', "0")
	
	return 'success'


@frappe.whitelist()
def make_invoice(source_name, target_doc=None, ignore_permissions=False):
	def postprocess(source, target):
		service_appointment = frappe.get_doc("Service Appointment", source_name)
		target.items = []
		target.service_type = service_appointment.service_type

		for fee in service_appointment.items:
			if (fee.rate - fee.invoiced_amount) > 0 or (fee.rate < 0 and fee.rate - fee.invoiced_amount < 0):
				item = target.append("items")
				item.item_code = fee.item
				item.qty = 1
				item.rate = fee.rate - fee.invoiced_amount
				item.service_appointment = service_appointment.name
				item.service_appointment_item = fee.name

		target.run_method("set_missing_values")
		target.run_method("set_taxes")
		target.run_method("calculate_taxes_and_totals")

	doclist = get_mapped_doc("Service Appointment", source_name, {
		"Service Appointment": {
			"doctype": "Sales Invoice",
		}
	}, target_doc, postprocess, ignore_permissions=ignore_permissions)

	return doclist

@frappe.whitelist()
def update_invoiced_amount(sales_invoice=None):
	import json

	service_appointment_items = frappe._dict()
	si = frappe._dict()

	if sales_invoice:
		si = frappe.get_doc("Sales Invoice", sales_invoice)

		for item in si.items:
			if item.service_appointment_item:
				service_appointment_items.setdefault(item.service_appointment_item, {}).update({ "invoice_no": sales_invoice, "invoice_item": item.name, "amount": item.amount })

	for (key, value) in service_appointment_items.items():
		sai = frappe.get_doc("Service Appointment Item", str(key))
		total_invoiced_amount = sai.invoiced_amount + value.get("amount")
		if (flt(sai.rate, 3) > 0 and flt(total_invoiced_amount, 3) > flt(sai.rate, 3)) or (flt(sai.rate, 3) < 0 and flt(total_invoiced_amount, 3) < flt(sai.rate, 3)):
			return { "status": "failed", "message": "Total invoiced amount is more than the actual amount." }
		else:
			if value.get("invoices_data"):
				invoices_data = json.loads(value.get("invoices_data"))

				for invoice in invoices_data:
					service_appointment_items.setdefault(str(key), {}).update({ "invoice_no": invoice.invoice_no, "invoice_item": invoice.invoice_item, "amount": invoice.amount })

				new_invoices_data = json.dumps(service_appointment_items.get(str(key)))
				frappe.db.set_value("Service Appointment Item", str(key), "invoiced_amount", total_invoiced_amount)
				frappe.db.set_value("Service Appointment Item", str(key), "invoices_data", new_invoices_data)
			else:
				invoices_data = json.dumps(service_appointment_items.get(str(key)))
				frappe.db.set_value("Service Appointment Item", str(key), "invoiced_amount", total_invoiced_amount)
				frappe.db.set_value("Service Appointment Item", str(key), "invoices_data", invoices_data)
		
		sa = frappe.get_doc('Service Appointment', sai.parent)
		if sa.service_contract:
			frappe.db.sql("""UPDATE `tabService Contract Visit`
			SET `payment_status` = '{payment_status}'
			WHERE `service_appointment` = '{service_appointment}'
			""".format(payment_status=si.status, service_appointment=sa.name))

	return { "status": "success" }

@frappe.whitelist()
def on_invoice_cancelled(sales_invoice=None):
	import json

	service_appointment_items = frappe._dict()
	si = frappe._dict()

	if sales_invoice:
		si = frappe.get_doc("Sales Invoice", sales_invoice)

		for item in si.items:
			if item.service_appointment_item:
				service_appointment_items.setdefault(item.service_appointment_item, {}).update({ "invoice_no": sales_invoice, "invoice_item": item.name, "amount": item.amount })

	for (key, value) in service_appointment_items.items():
		sai = frappe.get_doc("Service Appointment Item", str(key))
		total_invoiced_amount = sai.invoiced_amount + value.get("amount")
		if (sai.rate > 0 and total_invoiced_amount > sai.rate) or (sai.rate < 0 and total_invoiced_amount < sai.rate):
			return { "status": "failed", "message": "Total invoiced amount for the item " + value.get("item") + " is more than its amount." }
		else:
			if value.get("invoices_data"):
				invoices_data = json.loads(value.get("invoices_data"))

				for invoice in invoices_data:
					service_appointment_items.setdefault(str(key), {}).update({ "invoice_no": invoice.invoice_no, "invoice_item": invoice.invoice_item, "amount": invoice.amount })

				new_invoices_data = json.dumps(service_appointment_items.get(str(key)))
				frappe.db.set_value("Service Appointment Item", str(key), "invoiced_amount", total_invoiced_amount)
				frappe.db.set_value("Service Appointment Item", str(key), "invoices_data", new_invoices_data)
			else:
				invoices_data = json.dumps(service_appointment_items.get(str(key)))
				frappe.db.set_value("Service Appointment Item", str(key), "invoiced_amount", total_invoiced_amount)
				frappe.db.set_value("Service Appointment Item", str(key), "invoices_data", invoices_data)

		sa = frappe.get_doc('Service Appointment', sai.parent)
		if sa.service_contract:
			frappe.db.sql("""UPDATE `tabService Contract Visit`
			SET `payment_status` = '{payment_status}'
			WHERE `service_appointment` = '{service_appointment}'
			""".format(payment_status=si.status, service_appointment=sa.name))

	return { "status": "success" }

@frappe.whitelist()
def get_default_contact(doctype, name):
	'''Returns default contact for the given doctype, name'''
	out = frappe.db.sql('''select parent,
			IFNULL((select is_primary_contact from tabContact c where c.name = dl.parent), 0)
				as is_primary_contact
		from
			`tabDynamic Link` dl
		where
			dl.link_doctype=%s and
			dl.link_name=%s and
			dl.parenttype = "Contact"''', (doctype, name))

	def cmp(a, b):
		return (a > b) - (a < b) 

	if out:
		return sorted(out, key = functools.cmp_to_key(lambda x,y: cmp(cint(y[1]), cint(x[1]))))[0][0]
	else:
		return None

@frappe.whitelist()
def reschedule(source_name, target_doc=None, ignore_permissions=False):
	def postprocess(source, target):
		target.status = 'Draft'
		target.appointment_status = ''
		target.team = ''
		target.date = ''
		target.time = ''
		target.duration = ''
		target.start_time = ''
		target.end_time = ''
		target.actual_duration = ''
		target.used_materials = []
		target.mode_of_payment = ''
		target.received_amount = 0
		target.amount_received = ''
		target.reason_of_incompletion = ''
		target.remarks = ''
		target.customer_name = ''
		target.customer_mobile = ''
		target.signature = ''
		target.attachment = ''
		target.amended_from = ''
		target.related_to = source_name

	doclist = get_mapped_doc("Service Appointment", source_name, {
		"Service Appointment": {
			"doctype": "Service Appointment",
		}
	}, target_doc, postprocess, ignore_permissions=ignore_permissions)

	return doclist

@frappe.whitelist()
def continue_service(source_name, target_doc=None, ignore_permissions=False):
	def postprocess(source, target):
		service_appointment = frappe.get_doc("Service Appointment", source_name)
		target.status = 'Draft'
		target.appointment_status = ''
		target.team = ''
		target.date = ''
		target.time = ''
		target.duration = ''
		target.start_time = ''
		target.end_time = ''
		target.actual_duration = ''
		target.used_materials = []
		target.mode_of_payment = ''
		target.received_amount = 0
		target.amount_received = ''
		target.reason_of_incompletion = ''
		target.remarks = ''
		target.customer_name = ''
		target.customer_mobile = ''
		target.signature = ''
		target.attachment = ''
		target.amended_from = ''
		target.related_to = source_name
		target.service_type = 'Continuous'
		if service_appointment.service_contract:
			for item in target.items:
				item.rate = 0
				item.invoiced_amount = 0
				item.invoices_data = ''

	doclist = get_mapped_doc("Service Appointment", source_name, {
		"Service Appointment": {
			"doctype": "Service Appointment",
		}
	}, target_doc, postprocess, ignore_permissions=ignore_permissions)

	return doclist

@frappe.whitelist()
def complaint(source_name, target_doc=None, ignore_permissions=False):
	def postprocess(source, target):
		service_appointment = frappe.get_doc("Service Appointment", source_name)
		target.status = 'Draft'
		target.appointment_status = ''
		target.team = ''
		target.date = ''
		target.time = ''
		target.duration = ''
		target.start_time = ''
		target.end_time = ''
		target.actual_duration = ''
		target.used_materials = []
		target.mode_of_payment = ''
		target.received_amount = 0
		target.amount_received = ''
		target.reason_of_incompletion = ''
		target.remarks = ''
		target.customer_name = ''
		target.customer_mobile = ''
		target.signature = ''
		target.attachment = ''
		target.amended_from = ''
		target.related_to = source_name
		target.service_type = 'Contract Complaint' if source.service_type == 'Contract' else 'Complaint'
		target.collect_amount = 'No'
		target.sales_person = ''
		for item in target.items:
			item.rate = 0
			item.invoiced_amount = 0
			item.invoices_data = ''
			

	doclist = get_mapped_doc("Service Appointment", source_name, {
		"Service Appointment": {
			"doctype": "Service Appointment",
		}
	}, target_doc, postprocess, ignore_permissions=ignore_permissions)

	return doclist

@frappe.whitelist()
def get_payment_link(payment_entry):
	"""Returns public link for the attachment via `templates/emails/print_link.html`."""
	return frappe.get_template("templates/emails/print_link.html").render({
		"url": get_url(),
		"doctype": 'Payment Entry',
		"name": payment_entry,
		"print_format": 'Alqallaf PV Customer Copy',
		"key": frappe.get_doc('Payment Entry', payment_entry).get_signature()
	})

@frappe.whitelist()
def get_invoice_link(invoice):
	"""Returns public link for the attachment via `templates/emails/print_link.html`."""
	return frappe.get_template("templates/emails/print_link.html").render({
		"url": get_url(),
		"doctype": 'Sales Invoice',
		"name": invoice,
		"print_format": 'Tax Invoice SM',
		"key": frappe.get_doc('Sales Invoice', invoice).get_signature()
	})
