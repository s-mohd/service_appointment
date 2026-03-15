// Copyright (c) 2020, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt

frappe.ui.form.on('Service Appointment', {
	onload: function (frm) {
		frm.ignore_doctypes_on_cancel_all = ['Service Contract'];
		if (frm.is_new()) {
			frm.set_value('time', null);
			frm.set_value('start_time', null);
			frm.set_value('end_time', null);

			if (frm.doc.service_type == 'Complaint' || frm.doc.service_type == 'Continuous' || frm.doc.service_type == 'Contract Complaint') {
				check_and_set_availability(frm);
			}
			//frm.disable_save();
		} else {
			//frm.disable_save();
		}

		frm.set_query("customer", erpnext.queries.customer);

		frm.set_query('contact_person', function () {
			return {
				query: 'frappe.contacts.doctype.contact.contact.contact_query',
				filters: {
					link_doctype: 'Customer',
					link_name: frm.doc.customer
				}
			};
		});
		frm.set_query("customer_address", erpnext.queries.address_query);
		frm.set_query("item", "items", function (doc, cdt, cdn) {
			return {
				filters: {
					item_group: 'Services'
				}
			};
		});
	},

	refresh: function (frm) {
		let payment_status = '';
		$('.document-link-badge:nth(0)').removeClass('bg-danger');
		$('.document-link-badge:nth(0)').removeClass('text-white');
		$('.document-link-badge:nth(0)').removeClass('bg-success');

		$('[data-fieldname="add_update"] label').removeClass('hide');
		$('[data-fieldname="add_update"] button').addClass('btn-warning');
		$('[data-fieldname="add_update"] button').addClass('btn-block');
		make_service_area_table(frm);
		frappe.dynamic_link = { doc: frm.doc, fieldname: 'customer', doctype: 'Customer' };
		/*frm.toggle_display(['address_html'], !frm.doc.__islocal);

		if(!frm.doc.__islocal) {
			frappe.contacts.render_address_and_contact(frm);
		}*/
		if (frm.doc.docstatus == 1 && !frappe.user.has_role('System Manager')) {
			frm.set_df_property('guarantee_qty', 'read_only', 1);
			frm.set_df_property('guarantee_uom', 'read_only', 1);
			frm.set_df_property('expiry_date', 'read_only', 1);
		}

		if (!frm.doc.expiry_date && frm.doc.service_type != 'Contract' && frm.doc.service_type != 'Contract Complaint' 
		&& frm.doc.service_type != 'Disinfection' && frm.doc.service_type != 'Complaint') {
			set_expiry_date(frm);
		}

		if (!frappe.user_roles.includes('Back-Dated Appointment') && frm.doc.docstatus == 0) {
			// disable past dates in date field
			frm.fields_dict.date.datepicker.update({
				minDate: new Date(frappe.datetime.get_today()),
			});
		}

		if (frm.is_new()) {
			/*frm.page.set_primary_action(__('Check Availability'), function () {

				check_and_set_availability(frm);
			});*/
			if (!frm.doc.sales_person && frappe.session.user) {
				frappe.call({
					method: "frappe.client.get_list",
					args: {
						doctype: "Employee",
						fields: ["name"],
						filters: {
							"user_id": frappe.session.user_email
						}

					},
					callback: function (r) {
						if (r.message.length > 0) {
							frappe.call({
								method: "frappe.client.get_list",
								args: {
									doctype: "Sales Person",
									fields: ["name"],
									filters: {
										"employee": r.message[0].name
									}

								},
								callback: function (r) {
									if (r.message.length > 0) {
										frm.set_value('sales_person', r.message[0].name);
									}
								}
							});
						}
					}
				});
			}
		} else {
			//frm.page.set_primary_action(__('Save'), () => frm.save());
			//frm.disable_save();
			frm.call({
				method: 'get_payment_status',
				doc: frm.doc,
				async: false,
				freeze: true,
				callback: function (r) {
					payment_status = r.message;
					if (payment_status == 'Paid') {
						$('.document-link-badge:nth(0)').addClass('bg-success');
						$('.document-link-badge:nth(0)').addClass('text-white');
					} else if (payment_status) {
						$('.document-link-badge:nth(0)').addClass('bg-danger');
						$('.document-link-badge:nth(0)').addClass('text-white');
					}
				}
			});
		}

		frm.call({
			method: 'check_permission_of_service',
			doc: frm.doc,
			callback: function (r) {
				var is_service_team = r.message;
				//console.log(r.message);
				if (frm.doc.appointment_status != 'Completed' || (frm.doc.appointment_status == 'Completed' && frm.doc.docstatus == 0)) {
					if (!is_service_team || frappe.session.user == "Administrator") {
						frm.add_custom_button(__('Schedule/Reschedule'), function () {
							if (frm.doc.docstatus == 1) {
								if (frm.doc.appointment_status == 'Reschedule') {
									frappe.model.open_mapped_doc({
										method: "service_appointment.service_appointment.doctype.service_appointment.service_appointment.reschedule",
										frm: frm
									});
								} else if (frm.doc.appointment_status == 'Partially Completed') {
									frappe.model.open_mapped_doc({
										method: "service_appointment.service_appointment.doctype.service_appointment.service_appointment.continue_service",
										frm: frm
									});
								}

							} else {
								if(frm.doc.service_contract) {
									var customer_type = '';
									frappe.call({
										method: "frappe.client.get_value",
										async: false,
										args: {
											doctype: "Service Contract",
											filters: {"name": frm.doc.service_contract},
											fieldname: "customer_type"
										},
										callback: function(r){
											if(r.message){
												customer_type = r.message.customer_type;
											}
										}
									});

									if (customer_type == 'Prepaid') {
										frm.call({
											method: 'check_customer_balance',
											doc: frm.doc,
											async: false,
											callback: function (xx) {
												if (!xx.message.has_balance) {
													frappe.confirm(
														'This is a prepaid customer and does not have enough balance (' + xx.message.balance +'). <br>Continue any way?',
														function () {
															check_and_set_availability(frm);
														}
													);
												} else {
													check_and_set_availability(frm);
												}
											}
										});
									} else {
										check_and_set_availability(frm);
									}
								} else {
									check_and_set_availability(frm);
								}
							}
						});
					}
				}

				if ((frm.doc.appointment_status == 'Completed' || frm.doc.appointment_status == 'Partially Completed') && frm.doc.docstatus == 1) {
					if (!is_service_team || frappe.session.user == "Administrator") {
						frm.add_custom_button(__('Service Quality Feedback'), function () {
							frappe.route_options = {
								service_appointment: frm.doc.name
							}
							frappe.set_route('Form', 'Service Quality Feedback');
						});

						if ((payment_status == 'Paid' || !payment_status) && ((frm.doc.expiry_date && frappe.datetime.nowdate() < frm.doc.expiry_date) || (!frm.doc.expiry_date))) {
							frm.add_custom_button(__('Complaint'), function () {
								frappe.model.open_mapped_doc({
									method: "service_appointment.service_appointment.doctype.service_appointment.service_appointment.complaint",
									frm: frm
								});
							});
						}

						frm.add_custom_button(__('Send WhatsApp'), function () {
							frm.call({
								method: 'get_service_report_link',
								doc: frm.doc,
								callback: function (rrr) {
									var mobile = 0;
									frappe.call({
										method: "frappe.client.get_value",
										async: false,
										args: {
											doctype: "Customer",
											filters: {"name": frm.doc.customer},
											fieldname: "mobile_no"
										},
										callback: function(r){
											if(r.message){
												mobile = r.message.mobile_no;
											}
										}
									});

									frappe.confirm('Send Whatsapp to ' + mobile + ' ?', function () {
										var message = `شكراً لاختياركم القلاف\n`;
										message += `الرابط المرفق يحتوي على معلومات الخدمة المقدم\n`;
										message += urlify(rrr.message).replace(' ', '%20') + `\n`;
										message += `يرجى مراجعتنا في حال وجود أي استفسار`;

										if (mobile && message){
											//send_sms(mobile, message);
											var strWindowFeatures = "location=yes,height=570,width=520,scrollbars=no,status=yes";
											var URL = "https://wa.me/973" + mobile + "?text=" + encodeURIComponent(message);
											//URL = encodeURI(URL);
											var win = window.open(URL, '_blank', strWindowFeatures);
											
										} else {
											frappe.msgprint(__("Did not send Whatsapp, missing mobile number or message content."));
										}
									});
								}
							});
						});
					}
				}

				if (((frm.doc.appointment_status == 'Scheduled' || frm.doc.appointment_status == 'In Progress') && !frm.doc.__islocal)) {
					if (!is_service_team) {
						frm.add_custom_button(__('Cancel'), function () {
							frappe.confirm(
								'Are you sure to cancel?',
								function () {
									frappe.model.set_value('Service Appointment', frm.doc.name, 'appointment_status', 'Cancelled');
									frappe.model.set_value('Service Appointment', frm.doc.name, 'docstatus', '2');
									frappe.model.set_value('Service Appointment', frm.doc.name, 'status', 'Cancelled');
									frm.save();
								}
							);
						});
					}

					frm.add_custom_button(__('Complete'), function () {
						complete_service(frm);
					});
				}

				if (!is_service_team) {
					frm.add_custom_button(__("Generate Invoice"), function () {
						if (!cur_frm.doc.items) {
							frappe.throw("There are no items!");
						} else {
							var fees = cur_frm.doc.items;
							var total_fees = 0;
							$.each(fees, function (index, value) {
								total_fees += fees[index].rate - fees[index].invoiced_amount;
							});

							if (total_fees) {
								frappe.model.open_mapped_doc({
									method: "service_appointment.service_appointment.doctype.service_appointment.service_appointment.make_invoice",
									frm: frm
								});
							} else {
								frappe.throw("All items have been invoiced")
							}
						}
					});
				}
			}
		});
	},

	add_update(frm) {
		var service_area_json = [];
		if ('service_area_json' in frm.doc) {
			service_area_json = JSON.parse(frm.doc.service_area_json);
		}

		service_area_json.push({
			area_type: frm.doc.area_type,
			size: frm.doc.size,
			qty: frm.doc.qty,
			control_type: frm.doc.control_type,
			description: frm.doc.description
		});

		frm.set_value('service_area_json', JSON.stringify(service_area_json));

		make_service_area_table(frm);
	},

	customer(frm) {
		if (frm.doc.customer) {
			frappe.call({
				method: 'service_appointment.service_appointment.doctype.service_appointment.service_appointment.get_default_contact',
				args: {
					name: frm.doc.customer,
					doctype: 'Customer'
				},
				callback: (r) => {
					if (r.message) {
						frm.set_value('contact_person', r.message);
					}
				}
			});
			frappe.call({
				method: 'frappe.contacts.doctype.address.address.get_default_address',
				args: {
					name: frm.doc.customer,
					doctype: 'Customer'
				},
				callback: (r) => {
					if (r.message) {
						frm.set_value('customer_address', r.message);
					}
				}
			});
		}
	},

	customer_address(frm) {
		erpnext.utils.get_address_display(frm, "customer_address");
	},

	before_save(frm) {
		var total = 0;
		$.each(frm.doc.items || [], function (i, d) {
			total += flt(d.rate);
		});
		frm.set_value("total_amount", total);
	},

	guarantee_qty(frm) {
		set_expiry_date(frm);
	},

	guarantee_uom(frm) {
		set_expiry_date(frm);
	},

	date(frm) {
		if (frm.doc.date && !frappe.user_roles.includes('Back-Dated Appointment')) {
			if (frm.doc.date < frappe.datetime.nowdate()) {
				frappe.msgprint({
					title: __('Error'),
					message: __('Appointment date cannot be in the past'),
					indicator: 'red'
				});
				frm.set_value('date', '');
			}
		}
	}
});

frappe.ui.form.on("Service Appointment Item", "rate", function (frm, cdt, cdn) {
	var total = 0;
	$.each(frm.doc.items || [], function (i, d) {
		total += flt(d.rate);
	});
	frm.set_value("total_amount", total);
});

let check_and_set_availability = function (frm) {
	let selected_slot = null;
	let service_unit = null;
	let duration = null;
	let selected_slots = null;
	let selected_team = null;

	show_availability();

	function show_empty_state(team, appointment_date) {
		frappe.msgprint({
			title: __('Not Available'),
			message: __('Team {0} not available on {1}', [team.bold(), appointment_date.bold()]),
			indicator: 'red'
		});
	}

	function show_availability() {
		selected_team = '';
		let d = new frappe.ui.Dialog({
			title: __('Available slots'),
			fields: [
				{ fieldtype: 'Link', options: 'Team', fieldname: 'team', label: 'Team' },
				{ fieldtype: 'Column Break' },
				{ fieldtype: 'Date', reqd: 1, fieldname: 'appointment_date', label: 'Date' },
				{ fieldtype: 'Section Break' },
				{ fieldtype: 'HTML', fieldname: 'available_slots' }

			],
			primary_action_label: __('Book'),
			primary_action: function () {
				frm.set_value('time', selected_slots[0]);
				frm.set_value('duration', duration);
				frm.set_value('team', selected_team);
				frm.set_value('date', d.get_value('appointment_date'));
				let st_moment = moment(selected_slots[0], 'HH:mm:ss');
				let en_moment = st_moment.clone().add(duration, 'minutes');
				frm.set_value('start_time', st_moment.format("HH:mm:ss"));
				frm.set_value('end_time', en_moment.format("HH:mm:ss"));
				frm.set_value('actual_duration', duration);
				frm.set_value('appointment_status', 'Scheduled');
				d.hide();
				frm.enable_save();

				if (!frm.doc.expiry_date && frm.doc.service_type != 'Contract' && frm.doc.service_type != 'Contract Complaint' 
				&& frm.doc.service_type != 'Disinfection' && frm.doc.service_type != 'Complaint') {
					set_expiry_date(frm);
				}

				//Check Inspection
				check_inspection(frm);

				//Send SMS
				let date_moment = moment(d.get_value('appointment_date'), 'YYYY-MM-DD');
				var app_date = date_moment.format('DD-MM-YYYY')
				var mobile = '973' + frm.doc.mobile_no;
				var app_time = st_moment.format("HH:mm");
				//var message = `تم تحديد موعدك بتاريخ ${app_date} الساعة ${app_time}`;
				var message = `شكراً لاختياركم القلاف\n`;
				message += `تم تأكيد حجز موعدكم بتاريخ ${app_date} الساعة ${app_time}\n`;
				message += `هذه الرسالة تفيد موافقتكم على الشروط والتعليمات المرفقة https://rebrand.ly/5l1\n`;
				message += `يرجى مراجعتنا في حال وجود أي استفسار`;
				frm.save();
				d.get_primary_btn().attr('disabled', true);

				if (d.get_value('appointment_date') && frm.doc.mobile_no && selected_slots[0]) {
					frappe.confirm('Send SMS to ' + frm.doc.mobile_no + ' ?', function () {
						send_sms(mobile, message);
					});
				}
			}
		});

		d.set_values({
			'team': frm.doc.team,
			'appointment_date': (frm.doc.date ? frm.doc.date : frappe.datetime.add_days(frappe.datetime.now_date(), 1))
		});

		// disable dialog action initially
		d.get_primary_btn().attr('disabled', true);

		// Field Change Handler

		let fd = d.fields_dict;

		d.fields_dict['appointment_date'].df.onchange = () => {
			if (d.get_value('appointment_date') && d.get_value('appointment_date') < frappe.datetime.get_today() && !frappe.user_roles.includes('Back-Dated Appointment')) {
				frappe.msgprint({
					title: __('Error'),
					message: __('Appointment date cannot be in the past'),
					indicator: 'red'
				});
				d.set_value('appointment_date', '');
			} else {
				show_slots(d, fd);
			}
		};
		d.fields_dict['team'].df.onchange = () => {
			if (d.get_value('team') && d.get_value('team') != selected_team) {
				selected_team = d.get_value('team');
				show_slots(d, fd);
			} else if (selected_team != null) {
				selected_team = null;
				show_slots(d, fd);
			}
		};
		d.show();

		// disable past dates in date field
		if (!frappe.user_roles.includes('Back-Dated Appointment')) {
			d.fields_dict.appointment_date.datepicker.update({
				minDate: new Date(frappe.datetime.get_today()),
			});
		}
	}

	function show_slots(d, fd) {
		if (d.get_value('appointment_date')) {
			fd.available_slots.html('');
			frappe.call({
				method: 'service_appointment.service_appointment.doctype.service_appointment.service_appointment.get_availability_data',
				args: {
					team: d.get_value('team'),
					date: d.get_value('appointment_date')
				},
				callback: (r) => {
					let data = r.message;
					if (data.slot_details.length > 0) {
						let $wrapper = d.fields_dict.available_slots.$wrapper;

						// make buttons for each slot
						let slot_details = data.slot_details;
						let slot_html = '';
						for (let i = 0; i < slot_details.length; i++) {
							slot_html = slot_html + `<label>${slot_details[i].slot_name}</label>`;
							slot_html = slot_html + `<br/>` + slot_details[i].avail_slot.map(slot => {
								let disabled = '';
								let start_str = slot.from_time;
								let slot_start_time = moment(slot.from_time, 'HH:mm:ss');
								let slot_to_time = moment(slot.to_time, 'HH:mm:ss');
								let interval = (slot_to_time - slot_start_time) / 60000 | 0;
								let city = '';
								// iterate in all booked appointments, update the start time and duration
								slot_details[i].appointments.forEach(function (booked) {
									let booked_moment = moment(booked.time, 'HH:mm:ss');
									let end_time = booked_moment.clone().add(booked.duration, 'minutes');
									// Deal with 0 duration appointments
									if (booked_moment.isSame(slot_start_time) || booked_moment.isBetween(slot_start_time, slot_to_time)) {
										if (booked.duration == 0) {
											if (booked.name != cur_frm.doc.name) {
												disabled = 'disabled="disabled" data-disabled="yes"';
											}
											if (booked.city) {
												city = `<br> <small>${booked.city}</small>`;
											}
											return false;
										}
									}
									// Check for overlaps considering appointment duration
									if (slot_start_time.isBefore(end_time) && slot_to_time.isAfter(booked_moment)) {
										// There is an overlap
										if (booked.name != cur_frm.doc.name) {
											disabled = 'disabled="disabled" data-disabled="yes"';
										}
										if (booked.city) {
											city = `<br> <small>${booked.city}</small>`;
										}
										return false;
									}
								});

								return `<button class="btn ${(disabled != '' ? 'btn-danger' : 'btn-default')}"
									data-name="${start_str}"
									data-duration="${interval}"
									data-team='${slot_details[i].slot_name}'
									style="margin: 0 10px 10px 0; width: 72px;" ${disabled}>
									${start_str.substring(0, start_str.length - 3)} ${city}
								</button>`;
							}).join("");
							slot_html = slot_html + `<br/>`;
						}

						$wrapper
							.css('margin-bottom', 0)
							.addClass('text-center')
							.html(slot_html);

						// blue button when clicked
						$wrapper.find('button').click(function () {
							let $btn = $(this);
							$btn.toggleClass('btn-primary');
							if ($wrapper.find('.btn-primary').length) {
								$wrapper.find('button').attr('disabled', 'disabled');
								selected_slots = [];
								duration = 0;
								$wrapper.find('.btn-primary').each(function (index, el) {
									$(el).attr('disabled', null);

									var next = $(el).next('.btn').attr('data-disabled');
									if (typeof next !== typeof undefined && next !== false) {
										//$(el).next('.btn').attr('disabled', 'disabled');
									} else {
										$(el).next('.btn').attr('disabled', null);
									}

									var prev = $(el).prev('.btn').attr('data-disabled');
									if (typeof prev !== typeof undefined && prev !== false) {
										//$(el).prev('.btn').attr('disabled', 'disabled');
									} else {
										$(el).prev('.btn').attr('disabled', null);
									}

									prev = $btn.prev('.btn').hasClass('btn-primary');
									next = $btn.next('.btn').hasClass('btn-primary');

									if (prev && next) {
										//$btn.next('.btn').removeClass('btn-primary');
										var next_el = $btn.next('.btn');
										while ($(next_el).hasClass('btn-primary')) {
											$(next_el).removeClass('btn-primary');
											next_el = $(next_el).next('.btn');
										}
									}

									selected_slots.push($(el).attr('data-name'));
									selected_team = $(el).attr('data-team');
									duration += parseInt($(el).attr('data-duration'));
								});
								//selected_slot = $btn.attr('data-name');

								//duration = $btn.attr('data-duration');
								// enable dialog action
								d.get_primary_btn().attr('disabled', null);
							} else {
								$wrapper.find('button').attr('disabled', null);
								$wrapper.find('.btn[data-disabled="yes"]').attr('disabled', 'disabled');
								d.get_primary_btn().attr('disabled', 'disabled');
							}
						});

						//console.log($wrapper);

					} else {
						//	fd.available_slots.html('Please select a valid date.'.bold())
						show_empty_state(d.get_value('team'), d.get_value('appointment_date'));
					}
				},
				freeze: true,
				freeze_message: __('Fetching records......')
			});
		} else {
			fd.available_slots.html(__('Appointment date is Mandatory').bold());
		}
	}
};

let check_inspection = function (frm) {
	if (frm.doc.customer) {
		if (!frm.doc.customer_address) {
			frappe.throw("Please specify customer address to check for previous inspection.");
			return false;
		} else if(!frm.doc.date) {
			frappe.throw("Please specify service appointment date to check for previous inspection.");
			return false;
		}

		var inspection_deduct = false;
		var items = frm.doc.items;
		$.each(items, function (index, value) {
			if (items[index].rate < 0) {
				inspection_deduct = true;
			}
		});
		if(!inspection_deduct) {
			frappe.call({
				method: 'service_appointment.service_appointment.doctype.service_appointment.service_appointment.check_inspection',
				args: {
					customer: frm.doc.customer,
					customer_address: frm.doc.customer_address,
					date: frm.doc.date,
					time: frm.doc.time
				},
				callback: (r) => {
					if (r.message.invoiced_amount_value) {
						frappe.confirm('This customer has been invoiced for <b>INSPECTION</b> in appointment <b><a href="#Form/Service%20Appointment/' + r.message.service_appointment_name + '">' + r.message.service_appointment_name + '</a></b> with amount of <b>' + r.message.invoiced_amount + '</b><br>Subtract amount from this appointment?', function () {
							var item = frm.add_child("items");
							item.item = 'Inspection';
							item.rate = r.message.invoiced_amount_value * -1;
							frm.save();
						});
					}
				}
			});
		}
	}
}

let complete_service = function (frm) {
	let d = new frappe.ui.Dialog({
		title: __('Complete Service Appointment'),
		fields: [
			{ fieldname: 'ht', fieldtype: 'HTML' },
			{ fieldtype: 'Select', options: 'Completed\nPartially Completed\nReschedule\nCancelled', fieldname: 'status', label: 'Status' },
			{ fieldtype: 'Link', options: 'Employee', fieldname: 'completed_by', label: 'Completed By', read_only: 0 },
			{
				fieldtype: "Table", fieldname: "other_members", label: __("Other Members"), in_place_edit: true, depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"',
				fields: [
					{
						fieldtype: "Link",
						fieldname: "employee",
						label: __("Employee"),
						options: "Employee",
						in_list_view: 1,
						ignore_user_permissions: 1
					}
				]
			},
			{ fieldtype: 'Section Break', depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
			{ fieldtype: 'Time', fieldname: 'start_time', label: 'Start Time', depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
			{ fieldtype: 'Column Break', depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
			{ fieldtype: 'Time', fieldname: 'end_time', label: 'End Time', depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
			{ fieldtype: 'Column Break' },
			{ fieldtype: 'Int', fieldname: 'duration', label: 'Duration', read_only: 1, depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
			{ fieldtype: 'Section Break', label: 'Payment Details', depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
			{ fieldtype: 'Select', fieldname: 'collect_amount', label: 'Collect Amount', options: 'Yes\nNo', read_only: 1, depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
			{ fieldtype: 'Select', fieldname: 'amount_received', label: 'Amount Received', 'mandatory': 1, options: '\nYes\nNo', depends_on: 'eval:doc.status!="Reschedule" && doc.collect_amount=="Yes" && doc.status!="Cancelled"' },
			{ fieldtype: 'Column Break', depends_on: 'eval:doc.status!="Reschedule" && doc.collect_amount=="Yes"' },
			{ fieldtype: 'Currency', fieldname: 'amount', label: 'Amount', read_only: 1, depends_on: 'eval:doc.status!="Reschedule" && doc.collect_amount=="Yes" && doc.status!="Cancelled"' },
			{ fieldtype: 'Link', fieldname: 'mode_of_payment', label: 'Mode of Payment', options: 'Mode of Payment', depends_on: 'eval:doc.status!="Reschedule" && doc.collect_amount=="Yes" && doc.amount_received=="Yes" && doc.status!="Cancelled"' },
			{ fieldtype: 'Currency', fieldname: 'received_amount', label: 'Received Amount', depends_on: 'eval:doc.status!="Reschedule" && doc.collect_amount=="Yes" && doc.amount_received=="Yes" && doc.status!="Cancelled"' },
			{ fieldtype: 'Section Break', label: 'Used Materials', depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
			{
				fieldtype: "Table", fieldname: "used_materials", label: __("Used Materials"), in_place_edit: true, depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"',
				fields: [
					{
						fieldtype: "Link",
						fieldname: "item",
						label: __("Item"),
						options: "Item",
						in_list_view: 1
					},
					{
						fieldtype: "Select",
						fieldname: "uom",
						label: __("UOM"),
						//options: "UOM",
						in_list_view: 1,
						read_only: 1
					},
					{
						fieldtype: "Float",
						fieldname: "qty",
						label: __("Qty"),
						in_list_view: 1
					},
					{
						fieldtype: "Float",
						fieldname: "available_qty",
						label: __("Available Qty"),
						in_list_view: 1,
						read_only: 1
					}
				],
				data: (frm.doc.used_materials ? frm.doc.used_materials : []),
				get_data: () => {
					return (frm.doc.used_materials ? frm.doc.used_materials : []);
				}
			},
			{ fieldtype: 'Section Break' },
			{ fieldtype: 'Link', fieldname: 'reason', label: 'Reason of Incompletion', options: 'Reason of Incompletion', depends_on: 'eval:doc.status!="Completed"' },
			{ fieldtype: 'Small Text', fieldname: 'remarks', label: 'Remarks' },
			{ fieldtype: 'Data', fieldname: 'customer_name', label: 'Customer Name', 'mandatory': 1 },
			{ fieldtype: 'Data', fieldname: 'customer_mobile', label: 'Customer Mobile', 'mandatory': 1 },
			{ fieldtype: 'Signature', fieldname: 'customer_signature', label: 'Customer Signature', depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
			{ fieldtype: 'Attach Image', fieldname: 'attachment', label: 'Attachment' }
		],
		primary_action_label: __('Update'),
		primary_action: function () {
			/*frm.set_value('appointment_status', d.get_value('status'));
			frm.set_value('mode_of_payment', d.get_value('mode_of_payment'));
			frm.set_value('received_amount', (d.get_value('received_amount') ? d.get_value('received_amount') : 0));
			console.log(frm.doc.used_materials);
			frm.set_value('used_materials', null);
			console.log(frm.doc.used_materials);
			var used_materials_array = (d.get_value('used_materials') ? d.get_value('used_materials') : []);
			for (var i = 0; i < used_materials_array.length; i++) {
				var c = frm.add_child("used_materials");
				c.item = used_materials_array[i].item;
				c.qty = used_materials_array[i].qty;
				c.uom = used_materials_array[i].uom;
				
				//var c = frappe.model.add_child(frm.doc, 'Raw Material Item', 'used_materials');
				//frappe.model.set_value(c.doctype, c.name, 'item', used_materials_array[i].item);
				//frappe.model.set_value(c.doctype, c.name, 'qty', used_materials_array[i].qty);
				//frappe.model.set_value(c.doctype, c.name, 'uom', used_materials_array[i].uom);
			}
			console.log(frm.doc.used_materials);
			let st_moment = moment(d.get_value('start_time'), 'HH:mm:ss');
			let en_moment = moment(d.get_value('end_time'), 'HH:mm:ss');
			frm.set_value('start_time', st_moment.format("HH:mm:ss"));
			frm.set_value('end_time', en_moment.format("HH:mm:ss"));
			frm.set_value('actual_duration', d.get_value('duration'));
			frm.set_value('signature', d.get_value('customer_signature'));
			frm.set_value('remarks', d.get_value('remarks'));
			d.hide();
			//frm.enable_save();
			//frm.save();*/

			if (frm.doc.collect_amount == 'Yes' && !d.get_value('amount_received') && d.get_value('status') == 'Completed') {
				frappe.msgprint({
					title: __('Error'),
					message: __('Amount Received Field is Mandatory'),
					indicator: 'red'
				});
				return false;
			}

			if (frm.doc.collect_amount == 'Yes' && ((d.get_value('received_amount') == '' || d.get_value('received_amount') == null || d.get_value('received_amount') == undefined) && d.get_value('amount_received') == 'Yes') && d.get_value('status') == 'Completed') {
				frappe.msgprint({
					title: __('Error'),
					message: __('Received Amount Field is Mandatory'),
					indicator: 'red'
				});
				return false;
			}


			if (d.get_value('amount_received') == 'Yes' && ((d.get_value('mode_of_payment') == '' || d.get_value('mode_of_payment') == null || d.get_value('mode_of_payment') == undefined))) {
				frappe.msgprint({
					title: __('Error'),
					message: __('Mode of Payment is Mandatory'),
					indicator: 'red'
				});
				return false;
			}


			if (!d.get_value('customer_name') && d.get_value('status') == 'Completed') {
				frappe.msgprint({
					title: __('Error'),
					message: __('Customer Name is Mandatory'),
					indicator: 'red'
				});
				return false;
			}

			if (!d.get_value('customer_mobile') && d.get_value('status') == 'Completed') {
				frappe.msgprint({
					title: __('Error'),
					message: __('Customer Mobile is Mandatory'),
					indicator: 'red'
				});
				return false;
			}

			var used_materials_array = (d.get_value('used_materials') ? d.get_value('used_materials') : []);
			for (var i = 0; i < used_materials_array.length; i++) {
				if (!used_materials_array[i].item) {
					frappe.throw("Please select item for used materials in row " + (i+1))
					return false;
				} else if (!used_materials_array[i].qty) {
					frappe.throw("Please select qty for used materials in row " + (i+1))
					return false;
				} else if (!used_materials_array[i].uom) {
					frappe.throw("Please select uom for used materials in row " + (i+1))
					return false;
				}
			}

			let st_moment = moment(d.get_value('start_time'), 'HH:mm:ss');
			let en_moment = moment(d.get_value('end_time'), 'HH:mm:ss');
			var used_materials = (d.get_value('used_materials') ? d.get_value('used_materials') : []);

			var received_amount = (d.get_value('received_amount') ? d.get_value('received_amount') : 0);
			received_amount = (d.get_value('amount_received') == 'Yes' ? received_amount : 0);

			var completed_by = (d.get_value('completed_by') ? d.get_value('completed_by') : '');
			var other_members = (d.get_value('other_members') ? d.get_value('other_members') : []);

			frm.call({
				method: "complete_appointment",
				doc: frm.doc,
				args: {
					appointment_status: d.get_value('status'),
					reason_of_incompletion: d.get_value('reason'),
					mode_of_payment: d.get_value('mode_of_payment'),
					received_amount: received_amount,
					used_materials: used_materials,
					start_time: st_moment.format("HH:mm:ss"),
					end_time: en_moment.format("HH:mm:ss"),
					actual_duration: d.get_value('duration'),
					customer_name: d.get_value('customer_name'),
					customer_mobile: d.get_value('customer_mobile'),
					signature: d.get_value('customer_signature'),
					remarks: d.get_value('remarks'),
					attachment: d.get_value('attachment'),
					completed_by: completed_by,
					other_members: other_members
				},
				freeze: true,
				freeze_message: "Updating Service Appointment",
				callback: function (r, rt) {
					if (r.message == 'success') {
						d.hide();
						frm.reload_doc();
					}
				}
			});

			/*frm.call('complete_appointment').then(r => {
				if (r.message === 1) {
					//frm.refresh();
				}

				frm.reload_doc();
			});*/

			//frm.submit();
			//d.get_primary_btn().attr('disabled', true);
		}
	});

	let st_moment1 = moment(frm.doc.start_time, 'HH:mm:ss');
	let en_moment1 = moment(frm.doc.end_time, 'HH:mm:ss');
	let employee = '';
	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Employee",
			fields: ["name"],
			filters: {
				"user_id": frappe.session.user_email
			}

		},
		callback: function (r) {
			if (r.message.length > 0) {
				d.set_values({ 'completed_by': r.message[0].name });
			}
		}
	});

	d.set_values({
		'completed_by': employee,
		'status': ((frm.doc.appointment_status == 'Scheduled' || frm.doc.appointment_status == 'In Progress') ? 'Completed' : frm.doc.appointment_status),
		'start_time': st_moment1.format("HH:mm:ss"),
		'end_time': en_moment1.format("HH:mm:ss"),
		'duration': frm.doc.actual_duration,
		'collect_amount': frm.doc.collect_amount,
		'amount': frm.doc.total_amount,
		'mode_of_payment': frm.doc.mode_of_payment,
		'amount_received': (frm.doc.received_amount ? 'Yes' : ''),
		'received_amount': frm.doc.received_amount,
		'customer_name': (frm.doc.customer_name ? frm.doc.customer_name : frm.doc.customer),
		'customer_mobile': (frm.doc.customer_mobile ? frm.doc.customer_mobile : frm.doc.mobile_no),
		'signature': frm.doc.signature,
		'remarks': frm.doc.remarks
	});

	d.fields_dict['start_time'].df.onchange = () => {
		var actual_duration = get_duration(d.get_value('start_time'), d.get_value('end_time'));
		d.set_values({
			'duration': actual_duration
		});
	};

	d.fields_dict['end_time'].df.onchange = () => {
		var actual_duration = get_duration(d.get_value('start_time'), d.get_value('end_time'));
		d.set_values({
			'duration': actual_duration
		});
	};
	
	d.fields_dict.used_materials.grid.fields_map.item.get_query  =
			function() {
				return {
					filters: {
						"item_group": ["in", ["Technician Products", "Showroom Product", "Technician and Showroom Item", "Pesticides"]]
					}
				}
			}

	let emp_warehouse = '';
	d.fields_dict['completed_by'].df.onchange = () => {
		if (d.get_value('completed_by')) {
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Employee",
					name: d.get_value('completed_by')
				},
				callback: function (r) {
					if (r.message) {
						emp_warehouse = r.message.warehouse;
					}
				}
			});
		} else {
			emp_warehouse = '';
		}
	};

	d.fields_dict.used_materials.grid.fields_map.item.onchange = function (e) {
		const item_code_field = document.activeElement;
		const item_code = $(item_code_field).val();

		if (item_code) {
			frappe.call({
				method: "frappe.client.get",
				async: false,
				freeze: true,
				freeze_message: "Getting item data",
				args: {
					name: item_code,
					doctype: 'Item'
				},
				callback: (r) => {
					var row_idx = parseInt($(item_code_field).parents('.grid-row').data('idx')) - 1;
					
					var uoms = [];
					for(var y=0; y<r.message.uoms.length; y++) {
						uoms.push(r.message.uoms[y].uom);
					}

					if (uoms) {
						d.fields_dict.used_materials.grid.grid_rows[row_idx].set_field_property('uom', 'options', uoms);
					}

					let consume_uom = (r.message.consume_default_uom ? r.message.consume_default_uom : (r.message.stock_uom ? r.message.stock_uom : ''));

					$(item_code_field).parents('.grid-row').find('select[data-fieldname="uom"]').val(consume_uom);
					d.fields_dict.used_materials.grid.grid_rows[row_idx].doc.uom = consume_uom;

					$(item_code_field).parents('.grid-row').find('input[data-fieldname="qty"]').val(1);
					d.fields_dict.used_materials.grid.grid_rows[row_idx].doc.qty = 1;

					// get available qty
					if (emp_warehouse) {
						frappe.call({
							method: "erpnext.stock.utils.get_stock_balance",
							async: false,
							args: {
								item_code: item_code,
								warehouse: emp_warehouse
							},
							callback: function (r2) {
								if (r2.message) {
									$(item_code_field).parents('.grid-row').find('input[data-fieldname="available_qty"]').val(r2.message);
									d.fields_dict.used_materials.grid.grid_rows[row_idx].doc.available_qty = r2.message;
								}
							}
						});
					}
				}
			})
		} else {

		}
	}

	d.$wrapper.find('.awesomplete > [data-fieldname="item"]').on('')
	// disable dialog action initially
	//d.get_primary_btn().attr('disabled', true);

	var amount_html = ''
	if(frm.doc.collect_amount == 'Yes') {
		amount_html = '<div class="form-message red"><div>Collect Amount from customer</div></div>';
	} else {
		amount_html = '<div class="form-message green"><div>Don\'t Collect Amount from customer</div></div>';
	}

	d.fields_dict.ht.$wrapper.html(amount_html);

	d.show();
};

var make_service_area_table = function (frm) {
	var service_area_json = JSON.parse(frm.doc.service_area_json);

	for (var i = 0; i < service_area_json.length; i++) {
		var control_types = [];

		if (service_area_json[i]['control_type']) {
			for (var x = 0; x < service_area_json[i]['control_type'].length; x++) {
				control_types.push(service_area_json[i]['control_type'][x]['control_type']);
			}
		}

		service_area_json[i]['control_type'] = control_types.join(', ');
	}

	frm.fields_dict.service_area_html.html(
		frappe.render_template(`{% if data %}
        <style>
        .table-bordered > thead > tr > th, .table-bordered > tbody > tr > th, .table-bordered > tfoot > tr > th, .table-bordered > thead > tr > td, .table-bordered > tbody > tr > td, .table-bordered > tfoot > tr > td {
            border: 1px solid #979ea2;
            text-align: center;
            vertical-align: middle;
        }
        
        .table-bordered {
            border: 1px solid #979ea2;
        }

        .table-bordered > tbody > tr > th {
            padding: 5px;
        }

        .table-bordered > tbody > tr > td {
            padding: 0;
        }
        </style>
        <!--h5 style="margin-top: 20px;"> {{ __("Invoices Summary") }} </h5-->
        <table class="table table-bordered small">
            <thead>
                <tr style="background:#ccc">
                    <th style="width: 20%;">{{ __("Area Type") }}</th>
                    <th style="width: 20%;">{{ __("Size") }}</th>
                    <th style="width: 10%;">{{ __("Qty") }}</th>
                    <th style="width: 20%;">{{ __("Control Type") }}</th>
                    <th style="width: 20%;">{{ __("Description") }}</th>
                    <th style="width: 10%;">{{ __("Actions") }}</th>
                </tr>
        
            </thead>
            <tbody>
                {% for item in data %}
                    <tr>
                        <td> {%= item.area_type %} </td>
                        <td> {%= item.size %} </td>
                        <td> {%= item.qty %} </td>
                        <td> {%= item.control_type %} </td>
                        <td> {%= item.description %} </td>
                        <td> <button class="btn btn-danger delete-row btn-xs"><i class="fa fa-trash"></i></button> </td>
                    </tr>
                {% } %}
            </tbody>
        </table>
        {% } else { %}
        <p style="margin-top: 30px;"> No Areas. </p>
        {% } %}`, {
			data: service_area_json
		})
	);
}

$(document).on('click', '.delete-row', function () {
	var row_index = $(this).parents('tr').index();
	var service_area_json = JSON.parse(cur_frm.doc.service_area_json);

	if (row_index > -1) {
		service_area_json.splice(row_index, 1);
		$(this).parents('tr').remove();

		cur_frm.set_value('service_area_json', JSON.stringify(service_area_json));
	}
});

function get_duration(st_time, en_time) {
	var duration = 0;
	if (st_time && en_time) {
		let st_moment = moment(st_time, 'HH:mm:ss');
		let en_moment = moment(en_time, 'HH:mm:ss');
		var diff = moment.duration(en_moment.diff(st_moment));
		duration = diff.asMinutes();
	}

	return duration;
}

var set_expiry_date = function (frm) {
	var qty = frm.doc.guarantee_qty;
	var uom = frm.doc.guarantee_uom;
	var date = frm.doc.date;
	var expiry_date = '';

	if (date && qty && uom) {
		if (uom == 'Day') {
			expiry_date = frappe.datetime.add_days(date, qty);
		} else if (uom == 'Month' || uom == 'Year') {
			if (uom == 'Year') {
				qty = qty * 12;
			}

			expiry_date = frappe.datetime.add_months(date, qty);
		}

		frappe.model.set_value('Service Appointment', frm.doc.name, 'expiry_date', expiry_date);
	}
}

var send_sms = function (number, message) {
	// if (!number || !message) {
	// 	frappe.throw(__('Did not send SMS, missing mobile number or message content.'));
	// }
	// frappe.call({
	// 	method: 'frappe.core.doctype.sms_settings.sms_settings.send_sms',
	// 	args: {
	// 		receiver_list: [number],
	// 		msg: message
	// 	},
	// 	callback: function (r) {
	// 		if (r.exc) {
	// 			frappe.msgprint(r.exc);
	// 		}
	// 	}
	// });
};

function urlify(text) {
	var urlRegex = /href="(.*?)"/;
	return text.match(urlRegex)[1];
  }
