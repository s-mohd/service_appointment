// Copyright (c) 2020, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt

frappe.ui.form.on('Service Appointment', {
	onload: function (frm) {
		frm.ignore_doctypes_on_cancel_all = ['Service Contract'];
		if (frm.is_new()) {
			frm.set_value('time', null);
			frm.set_value('start_time', null);
			frm.set_value('end_time', null);
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
				if ((!is_service_team || frappe.session.user == "Administrator") && is_booking_editable_status(frm.doc)) {
					frm.add_custom_button(__('Find Best Slot'), function () {
						open_find_best_slot_with_rules(frm);
					});
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
											filters: { "name": frm.doc.customer },
											fieldname: "mobile_no"
										},
										callback: function (r) {
											if (r.message) {
												mobile = r.message.mobile_no;
											}
										}
									});

									frappe.confirm('Send Whatsapp to ' + mobile + ' ?', function () {
										var message = `شكراً لاختياركم القلاف\n`;
										message += `الرابط المرفق يحتوي على معلومات الخدمة المقدم\n`;
										message += urlify(rrr.message).replace(' ', '%20') + `\n`;
										message += `يرجى مراجعتنا في حال وجود أي استفسار`;

										if (mobile && message) {
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

		ensure_best_slot_panel(frm);
		refresh_best_slot_suggestions(frm, { silent: true });
		render_dispatch_action_bar(frm);
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
		refresh_best_slot_suggestions(frm, { silent: true });
		schedule_auto_dispatch_apply(frm, { source: 'manual_customer' });
	},

	customer_address(frm) {
		erpnext.utils.get_address_display(frm, "customer_address");
		refresh_best_slot_suggestions(frm);
		schedule_auto_dispatch_apply(frm, { source: 'manual_address' });
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
		refresh_best_slot_suggestions(frm);
		schedule_auto_dispatch_apply(frm, { source: 'manual_date' });
	},

	time(frm) {
		refresh_best_slot_suggestions(frm, { silent: true });
		schedule_auto_dispatch_apply(frm, { source: 'manual_time' });
	},

	duration(frm) {
		// Manual duration change should not auto-trigger slot/dispatch.
	},

	team(frm) {
		// Manual team change should not auto-trigger slot/dispatch.
	},

	service_type(frm) {
		// Service Type change should not auto-trigger slot/dispatch.
	},

	building_type(frm) {
		// Building Type change should not auto-trigger slot/dispatch.
	},

	pest_type(frm) {
		// Pest Type change should not auto-trigger slot/dispatch.
	},

	after_save(frm) {
		refresh_best_slot_suggestions(frm, { silent: true });
		if (frm.__pending_auto_dispatch_apply) {
			frm.__pending_auto_dispatch_apply = false;
			trigger_auto_dispatch_apply(frm, { auto: true, source: 'after_save' });
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

frappe.ui.form.on("Service Appointment Item", "item", function (frm) {
	// Item change should not auto-trigger slot/dispatch.
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
				frm.__pending_auto_dispatch_apply = true;
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
		} else if (!frm.doc.date) {
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
		if (!inspection_deduct) {
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
					frappe.throw("Please select item for used materials in row " + (i + 1))
					return false;
				} else if (!used_materials_array[i].qty) {
					frappe.throw("Please select qty for used materials in row " + (i + 1))
					return false;
				} else if (!used_materials_array[i].uom) {
					frappe.throw("Please select uom for used materials in row " + (i + 1))
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

	d.fields_dict.used_materials.grid.fields_map.item.get_query =
		function () {
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
					for (var y = 0; y < r.message.uoms.length; y++) {
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
	if (frm.doc.collect_amount == 'Yes') {
		amount_html = '<div class="form-message red"><div>Collect Amount from customer</div></div>';
	} else {
		amount_html = '<div class="form-message green"><div>Don\'t Collect Amount from customer</div></div>';
	}

	d.fields_dict.ht.$wrapper.html(amount_html);

	d.show();
};

let schedule_auto_dispatch_apply = function (frm, options) {
	options = Object.assign({ auto: true, source: 'form' }, options || {});
	if (!frm || frm.doc.docstatus == 2 || frm.doc.appointment_status == 'Cancelled') {
		return;
	}
	if (frm.__applying_best_slot) {
		return;
	}
	if (frm.__auto_dispatch_timer) {
		clearTimeout(frm.__auto_dispatch_timer);
	}
	frm.__auto_dispatch_timer = setTimeout(function () {
		trigger_auto_dispatch_apply(frm, options);
	}, 550);
};

let trigger_auto_dispatch_apply = function (frm, options) {
	options = Object.assign({ auto: false, source: 'form', force_recalculate: 0 }, options || {});
	if (!frm || frm.doc.docstatus == 2 || frm.doc.appointment_status == 'Cancelled') {
		return;
	}
	if (!frm.doc.date || !frm.doc.time || !frm.doc.duration || !frm.doc.customer_address) {
		return;
	}
	if (frm.doc.__islocal || !frm.doc.name) {
		frm.__pending_auto_dispatch_apply = true;
		return;
	}
	if (frm.__is_auto_dispatch_inflight) {
		return;
	}

	const snapshot_key = get_dispatch_snapshot_storage_key(frm.doc.name);
	const snapshot = get_dispatch_snapshot(frm);
	if (snapshot_key && snapshot) {
		set_local_storage_value(snapshot_key, JSON.stringify(snapshot));
	}

	frm.__is_auto_dispatch_inflight = true;
	frappe.call({
		method: 'service_appointment.service_appointment.dispatch.auto_dispatch_apply',
		args: {
			appointment: frm.doc.name,
			force_recalculate: options.force_recalculate ? 1 : 0,
			source: options.source || 'form',
		},
		freeze: !options.auto,
		freeze_message: __('Auto dispatching team and members...'),
		callback: function (r) {
			frm.__is_auto_dispatch_inflight = false;
			const out = r.message || {};
			if (out.status === 'skipped') {
				frappe.show_alert({ message: out.message || __('Auto dispatch skipped (locked).'), indicator: 'orange' }, 7);
				render_dispatch_action_bar(frm);
				return;
			}
			if (out.status !== 'success') {
				const msg = out.message || __('Auto dispatch failed.');
				frappe.show_alert({ message: msg, indicator: 'red' }, 8);
				return;
			}

			const warning = cint(out.shortage_count) > 0 || cint(out.is_fallback);
			const indicator = warning ? 'orange' : 'green';
			const status_text = __('Auto-selected team {0} | Assigned {1}/{2}', [
				out.team || '-',
				out.assigned_count || 0,
				out.required_members || 1,
			]);
			frappe.show_alert({ message: status_text, indicator }, 6);
			render_dispatch_action_bar(frm);
			frm.reload_doc();
		},
		error: function () {
			frm.__is_auto_dispatch_inflight = false;
		},
	});
};

let is_booking_editable_status = function (doc) {
	if (!doc) return false;
	if (doc.docstatus == 2) return false;
	const st = doc.appointment_status || '';
	return !['Completed', 'Cancelled'].includes(st);
};

let open_find_best_slot_with_rules = function (frm) {
	const continue_fn = () => {
		if (!frm.doc.date) {
			frappe.prompt(
				[{ fieldtype: 'Date', fieldname: 'date', label: __('Date'), reqd: 1, default: frappe.datetime.now_date() }],
				(values) => {
					frm.set_value('date', values.date);
					refresh_best_slot_suggestions(frm, { force: true });
					focus_best_slot_panel(frm);
				},
				__('Find Best Slot'),
				__('Load Slots')
			);
			return;
		}
		refresh_best_slot_suggestions(frm, { force: true });
		focus_best_slot_panel(frm);
	};

	if (!frm.doc.service_contract) {
		continue_fn();
		return;
	}

	frappe.call({
		method: "frappe.client.get_value",
		args: {
			doctype: "Service Contract",
			filters: { "name": frm.doc.service_contract },
			fieldname: "customer_type"
		},
		callback: function (r) {
			const customer_type = (r.message && r.message.customer_type) || '';
			if (customer_type !== 'Prepaid') {
				continue_fn();
				return;
			}
			frm.call({
				method: 'check_customer_balance',
				doc: frm.doc,
				callback: function (xx) {
					if (!xx.message || xx.message.has_balance) {
						continue_fn();
						return;
					}
					frappe.confirm(
						__('This is a prepaid customer and does not have enough balance ({0}). Continue anyway?', [xx.message.balance]),
						() => continue_fn()
					);
				}
			});
		}
	});
};

let ensure_best_slot_panel = function (frm) {
	if ($('#sa-best-slot-style').length === 0) {
		$('head').append(`
					<style id="sa-best-slot-style">
						.sa-best-slot-panel { margin-top: 6px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--fg-color); padding: 10px; }
						.sa-best-slot-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
						.sa-best-slot-controls { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
						.sa-best-slot-controls .sa-preferred-time-control { width: 126px; min-width: 126px; }
						.sa-best-slot-controls .sa-preferred-time-control .frappe-control { margin-bottom: 0; }
						.sa-best-slot-controls .sa-preferred-time-control .control-input-wrapper { display: flex; }
						.sa-best-slot-title { font-weight: 700; font-size: 13px; }
						.sa-best-slot-sub { font-size: 11px; color: var(--text-muted); }
						.sa-best-slot-list { display: flex; flex-direction: column; gap: 6px; }
						.sa-best-slot-item { border: 1px solid var(--border-color); border-radius: 8px; padding: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px; background: var(--fg-color); }
						.sa-best-slot-item.selected { border-color: var(--primary); background: rgba(10, 124, 255, 0.06); }
						.sa-best-slot-item .sa-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
						.sa-slot-left { display: flex; align-items: flex-start; gap: 8px; }
						.sa-slot-chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px; border-radius: 999px; background: var(--gray-100); margin-right: 4px; }
						.sa-dispatch-actions { margin-top: 8px; display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
						.sa-slot-selection-summary { margin-top: 6px; font-size: 11px; color: var(--text-muted); }
						.sa-status-pill { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--gray-100); }
						.sa-undo-link.btn.btn-link { padding: 0; min-height: unset; height: auto; font-size: 11px; }
						.sa-panel-note { font-size: 11px; color: var(--text-muted); }
					</style>
			`);
		}
	if (frm.__best_slot_panel) {
		return frm.__best_slot_panel;
	}
		const $panel = $(`
				<div class="sa-best-slot-panel">
					<div class="sa-best-slot-head">
							<div>
								<div class="sa-best-slot-title">${__('Best Available Slots')}</div>
								<div class="sa-best-slot-sub">${__('Pick preferred time, select slots, then apply.')}</div>
							</div>
							<div class="sa-best-slot-controls">
								<div class="sa-preferred-time-control"></div>
								<button type="button" class="btn btn-xs btn-default sa-apply-selected-slot" disabled>${__('Apply Selected')}</button>
							</div>
						</div>
				<div class="sa-best-slot-list"></div>
				<div class="sa-slot-selection-summary"></div>
				<div class="sa-dispatch-actions"></div>
		</div>
	`);
	const date_field = frm.get_field('date');
	if (date_field && date_field.$wrapper) {
		date_field.$wrapper.after($panel);
	} else {
		$(frm.fields_dict.date.wrapper).after($panel);
	}

	const preferred_time_control = frappe.ui.form.make_control({
		parent: $panel.find('.sa-preferred-time-control'),
		df: {
			fieldtype: 'Time',
			fieldname: 'preferred_time',
			placeholder: __('Preferred Time'),
		},
		only_input: true,
		render_input: true,
	});
		preferred_time_control.refresh();
		preferred_time_control.$input.addClass('input-xs');
		preferred_time_control.$input.on('change', () => {
			frm.__slot_preferred_time = preferred_time_control.get_value() || '';
			schedule_slot_suggestion_refresh(frm);
		});

		$panel.on('click', '.sa-toggle-slot-select', (e) => {
			const idx = cint($(e.currentTarget).data('idx'));
			const checked = !!((frm.__selected_best_slot_indexes || {})[String(idx)]);
			toggle_best_slot_selection(frm, idx, checked);
		});
		$panel.on('click', '.sa-apply-selected-slot', () => {
			const aggregate = build_combined_slot_from_selected(frm);
			if (!aggregate) return;
			maybe_prompt_reschedule_reason(frm, aggregate, (reason) => {
				apply_best_slot(frm, aggregate, { source: 'best_slot_multi', reschedule_reason: reason });
			});
		});
		$panel.on('click', '.sa-undo-dispatch', () => undo_last_auto_dispatch(frm));
		const initial_time = to_backend_time_string(normalize_time_for_input(frm.doc.time) || '09:00');
		preferred_time_control.set_value(initial_time);
	frm.__slot_preferred_time_control = preferred_time_control;
	frm.__slot_preferred_time = preferred_time_control.get_value() || initial_time;

	frm.__best_slot_panel = $panel;
	return $panel;
};

let focus_best_slot_panel = function (frm) {
	const panel = ensure_best_slot_panel(frm);
	if (panel && panel.length && panel[0]) {
		panel[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
};

let get_best_slot_context_payload = function (frm) {
	const panel = ensure_best_slot_panel(frm);
	const preferred_time = get_preferred_time_value(frm, panel);
	return {
		date: frm.doc.date || '',
		customer_address: frm.doc.customer_address || '',
		service_type: frm.doc.service_type || '',
		building_type: frm.doc.building_type || '',
		required_members: frm.doc.required_members || 1,
		duration: frm.doc.duration || 0,
		preferred_time: to_backend_time_string(preferred_time),
		pest_type: frm.doc.pest_type || [],
		items: (frm.doc.items || []).map((row) => ({ item: row.item })),
	};
};

let refresh_best_slot_suggestions = function (frm, options) {
	options = Object.assign({ silent: false, force: false }, options || {});
	const panel = ensure_best_slot_panel(frm);
	const list = panel.find('.sa-best-slot-list');
	const preferred_time = get_preferred_time_value(frm, panel);
	list.html(`<div class="sa-panel-note">${__('Loading slot suggestions...')}</div>`);
	frm.__best_slot_suggestions = [];

	if (!frm.doc.date) {
		list.html(`<div class="sa-panel-note">${__('Select a date to see best available slots.')}</div>`);
		return;
	}
	if (!frm.doc.customer_address) {
		list.html(`<div class="sa-panel-note">${__('Select customer address to calculate best slots.')}</div>`);
		return;
	}

	const call_args = {
		appointment: (!frm.doc.__islocal && frm.doc.name) ? frm.doc.name : '',
		date: frm.doc.date,
		context_payload: frm.doc.__islocal ? get_best_slot_context_payload(frm) : null,
		preferred_time: to_backend_time_string(preferred_time),
		limit: 5,
	};

	frappe.call({
		method: 'service_appointment.service_appointment.dispatch.get_best_slots',
		args: call_args,
		freeze: false,
		callback: function (r) {
			const out = r.message || {};
			const slots = out.slots || [];
			const suggested_duration = cint(out.default_duration) || 0;
			if (suggested_duration > 0 && cint(frm.doc.duration) !== suggested_duration) {
				frm.set_value('duration', suggested_duration);
			}
			frm.__best_slot_suggestions = slots;
			frm.__selected_best_slot_indexes = {};
			if (!slots.length) {
				list.html(`<div class="sa-panel-note">${__('No suitable slots found for this date and context.')}</div>`);
				update_best_slot_selection_ui(frm);
				return;
			}
				const rows = slots.map((slot, idx) => {
					const coverage = slot.coverage_match_type ? `<span class="sa-slot-chip">${__(slot.coverage_match_type)}</span>` : '';
					const fallback = cint(slot.is_fallback) ? `<span class="sa-slot-chip">${__('Fallback')}</span>` : '';
					return `
						<div class="sa-best-slot-item" data-idx="${idx}">
							<div class="sa-slot-left">
								<div>
									<div><b>${frappe.utils.escape_html(format_slot_time(slot.time || '--'))}</b> · ${cint(slot.duration || 0)}m · ${frappe.utils.escape_html(slot.team_name || slot.team || '-')}</div>
									<div class="sa-meta"><span class="sa-slot-chip">${__('Load')}: ${cint(slot.team_load || 0)}</span>${coverage}${fallback}</div>
								</div>
							</div>
							<button type="button" class="btn btn-xs btn-default sa-toggle-slot-select" data-idx="${idx}">${__('Select')}</button>
						</div>
				`;
			});
			list.html(rows.join(''));
			update_best_slot_selection_ui(frm);
		},
		error: (res) => {
			let message = __('Could not load slot suggestions.');
			const raw_server = res && res._server_messages;
			if (raw_server) {
				try {
					const parsed = JSON.parse(raw_server);
					if (Array.isArray(parsed) && parsed.length) {
						const msg_obj = JSON.parse(parsed[0]);
						message = msg_obj.message || message;
					}
				} catch (e) {
					// ignore parse issue
				}
			}
			list.html(`<div class="sa-panel-note">${frappe.utils.escape_html(message)}</div>`);
			update_best_slot_selection_ui(frm);
			if (!options.silent) {
				frappe.show_alert({ message, indicator: 'orange' }, 7);
			}
		},
	});
};

let schedule_slot_suggestion_refresh = function (frm) {
	if (!frm) return;
	if (frm.__slot_suggestion_timer) {
		clearTimeout(frm.__slot_suggestion_timer);
	}
	frm.__slot_suggestion_timer = setTimeout(() => {
		refresh_best_slot_suggestions(frm, { silent: true, force: true });
	}, 250);
};

let get_preferred_time_value = function (frm, panel) {
	panel = panel || ensure_best_slot_panel(frm);
	let value = '';
	if (frm.__slot_preferred_time_control) {
		value = frm.__slot_preferred_time_control.get_value() || '';
	}
	if (!value) {
		value = frm.__slot_preferred_time || '';
	}
	if (!value) {
		value = to_backend_time_string(normalize_time_for_input(frm.doc.time) || '');
	}
	if (frm.__slot_preferred_time_control && value && frm.__slot_preferred_time_control.get_value() !== value) {
		frm.__slot_preferred_time_control.set_value(value);
	}
	frm.__slot_preferred_time = value;
	return value;
};

let toggle_best_slot_selection = function (frm, idx, checked) {
	if (!frm.__selected_best_slot_indexes) {
		frm.__selected_best_slot_indexes = {};
	}
	if (checked) {
		delete frm.__selected_best_slot_indexes[String(idx)];
	} else {
		frm.__selected_best_slot_indexes[String(idx)] = 1;
	}
	update_best_slot_selection_ui(frm);
};

let get_selected_best_slots = function (frm) {
	const indexes = Object.keys(frm.__selected_best_slot_indexes || {}).map((idx) => cint(idx));
	const slots = (frm.__best_slot_suggestions || []).filter((slot, idx) => indexes.includes(idx));
	return slots.sort((a, b) => time_to_minutes(a.time) - time_to_minutes(b.time));
};

let build_combined_slot_from_selected = function (frm) {
	const selected = get_selected_best_slots(frm);
	if (!selected.length) {
		frappe.msgprint(__('Select one or more slots first.'));
		return null;
	}
	if (selected.length === 1) {
		return Object.assign({}, selected[0], { slots: selected });
	}
	const anchor = selected[0];
	const team = anchor.team;
	const date = anchor.date;
	let start_minutes = time_to_minutes(anchor.time);
	const duration = get_selected_slot_total_minutes(selected);
	if (duration <= 0) {
		frappe.msgprint(__('Invalid selected slot duration.'));
		return null;
	}
	return {
		date,
		time: minutes_to_time_string(start_minutes),
		duration,
		team,
		team_name: selected[0].team_name || selected[0].team,
		slots: selected.map((slot) => ({
			date: slot.date,
			time: slot.time,
			duration: cint(slot.duration) || 0,
			team: slot.team,
		})),
	};
};

let update_best_slot_selection_ui = function (frm) {
	const panel = ensure_best_slot_panel(frm);
	const selected = get_selected_best_slots(frm);
	const summary = panel.find('.sa-slot-selection-summary');
	const applySelectedBtn = panel.find('.sa-apply-selected-slot');

	panel.find('.sa-best-slot-item').removeClass('selected');
	panel.find('.sa-toggle-slot-select').each((_, el) => {
		const idx = String(cint($(el).data('idx')));
		const checked = !!(frm.__selected_best_slot_indexes || {})[idx];
		const $btn = $(el);
		$btn.text(checked ? __('Unselect') : __('Select'));
		$btn.toggleClass('btn-default', !checked);
		$btn.toggleClass('btn-warning', checked);
		if (checked) {
			$btn.closest('.sa-best-slot-item').addClass('selected');
		}
	});

	if (!selected.length) {
		summary.html('');
		applySelectedBtn.prop('disabled', true);
		return;
	}
	const duration = get_selected_slot_total_minutes(selected);
	const first = selected[0];
	const last = selected[selected.length - 1];
	summary.html(
		`${__('Selected')}: ${selected.length} · ${__('Duration')}: ${duration}m · ${__('From')}: ${frappe.utils.escape_html(format_slot_time(first.time || '--'))} · ${__('To')}: ${frappe.utils.escape_html(format_slot_time(minutes_to_time_string(time_to_minutes(last.time) + cint(last.duration || 0)) || '--'))}`
	);
	applySelectedBtn.prop('disabled', false);
};

let get_selected_slot_total_minutes = function (selected) {
	if (!selected || !selected.length) return 0;
	if (selected.length === 1) {
		return cint(selected[0].duration) || 0;
	}
	const starts = selected
		.map((row) => time_to_minutes(row.time))
		.filter((v) => v !== null && v !== undefined)
		.sort((a, b) => a - b);
	if (!starts.length) return 0;
	const start = starts[0];
	const end = starts[starts.length - 1];
	return Math.max(0, (end - start) + 60);
};

let format_slot_time = function (value) {
	if (!value) return '--';
	if (typeof moment !== 'undefined') {
		const m = moment(value, 'HH:mm:ss', true);
		if (m.isValid()) {
			return m.format('h:mm A');
		}
	}
	return value;
};

let maybe_prompt_reschedule_reason = function (frm, slot, done) {
	if (frm.doc.__islocal || !frm.doc.name) {
		done('');
		return;
	}
	const editable_statuses = ['Scheduled', 'In Progress', 'Reschedule', 'Partially Completed'];
	const slot_changed = (frm.doc.date != slot.date) || (frm.doc.time != slot.time) || (cint(frm.doc.duration) != cint(slot.duration));
	if (!slot_changed || !editable_statuses.includes(frm.doc.appointment_status || '')) {
		done('');
		return;
	}
	frappe.prompt(
		[{ fieldtype: 'Small Text', fieldname: 'reason', label: __('Reschedule Reason') }],
		(values) => done((values.reason || '').trim()),
		__('Reschedule Reason'),
		__('Apply Slot')
	);
};

let apply_best_slot = function (frm, slot, options) {
	options = Object.assign({ source: 'best_slot', reschedule_reason: '' }, options || {});
	if (!slot) return;

	const snapshot = get_dispatch_snapshot(frm);
	const save_snapshot_key = get_dispatch_snapshot_storage_key(frm.doc.name);
	if (snapshot && save_snapshot_key) {
		set_local_storage_value(save_snapshot_key, JSON.stringify(snapshot));
	}

	frm.__applying_best_slot = true;

	if (frm.doc.__islocal || !frm.doc.name) {
		frm.set_value('date', slot.date);
		frm.set_value('time', slot.time);
		frm.set_value('duration', slot.duration);
		frm.set_value('team', slot.team);
		frm.set_value('start_time', slot.time);
		frm.set_value('end_time', minutes_to_time_string(time_to_minutes(slot.time) + cint(slot.duration)));
		frm.set_value('actual_duration', slot.duration);
		frm.set_value('appointment_status', 'Scheduled');
		frm.__pending_auto_dispatch_apply = true;
		frm.save().then(() => {
			frm.__applying_best_slot = false;
			render_dispatch_action_bar(frm);
		});
		frappe.show_alert({ message: __('Best slot applied. Saving and auto dispatching...'), indicator: 'green' }, 6);
		return;
	}

	frappe.call({
		method: 'service_appointment.service_appointment.dispatch.apply_slot_and_auto_dispatch',
		args: {
			appointment: frm.doc.name,
			slot_payload: {
				date: slot.date,
				time: slot.time,
				duration: slot.duration,
				team: slot.team,
				slots: slot.slots || [],
				reschedule_reason: options.reschedule_reason || '',
			},
			expected_modified: frm.doc.modified,
			force_recalculate: 0,
		},
		freeze: true,
		freeze_message: __('Applying slot and auto dispatch...'),
		callback: function (r) {
			frm.__applying_best_slot = false;
			const out = r.message || {};
			if (out.status !== 'success') {
				frappe.msgprint(out.message || __('Could not apply best slot.'));
				return;
			}
			const warning = cint(out.shortage_count) > 0 || cint(out.is_fallback);
			frappe.show_alert(
				{
					message: __('Best slot applied: {0} ({1}m), team {2}.', [slot.time, cint(slot.duration), out.team || slot.team]),
					indicator: warning ? 'orange' : 'green',
				},
				7
			);
			frm.reload_doc();
		},
		error: function () {
			frm.__applying_best_slot = false;
		},
	});
};

let render_dispatch_action_bar = function (frm) {
	const panel = ensure_best_slot_panel(frm);
	const actions = panel.find('.sa-dispatch-actions');
	const has_snapshot = !!get_local_storage_value(get_dispatch_snapshot_storage_key(frm.doc.name));
	if (!frm.doc.name || frm.doc.__islocal) {
		actions.html('');
		return;
	}
	actions.html(`
		<span class="sa-status-pill">${__('Dispatch')}: ${frappe.utils.escape_html(frm.doc.assignment_state || '-')}</span>
		${has_snapshot ? `<button type="button" class="btn btn-link sa-undo-dispatch sa-undo-link">${__('Undo Last Auto Dispatch')}</button>` : ''}
	`);
};

let undo_last_auto_dispatch = function (frm) {
	const key = get_dispatch_snapshot_storage_key(frm.doc.name);
	const raw = get_local_storage_value(key);
	if (!raw) {
		frappe.msgprint(__('No dispatch snapshot available to undo.'));
		return;
	}
	let snapshot = null;
	try {
		snapshot = JSON.parse(raw);
	} catch (e) {
		remove_local_storage_value(key);
		frappe.msgprint(__('Dispatch snapshot is invalid.'));
		return;
	}
	frappe.call({
		method: 'service_appointment.service_appointment.dispatch.restore_assignment',
		args: {
			appointment: frm.doc.name,
			snapshot_payload: snapshot,
			expected_modified: frm.doc.modified,
		},
		freeze: true,
		freeze_message: __('Restoring previous assignment...'),
		callback: function (r) {
			const out = r.message || {};
			if (out.status !== 'success') {
				frappe.msgprint(out.message || __('Could not restore assignment.'));
				return;
			}
			remove_local_storage_value(key);
			frappe.show_alert({ message: __('Previous assignment restored.'), indicator: 'green' }, 6);
			frm.reload_doc();
		},
	});
};

let get_dispatch_snapshot = function (frm) {
	if (!frm || !frm.doc) return null;
	return {
		team: frm.doc.team || '',
		required_members: cint(frm.doc.required_members) || 1,
		selected_members: (frm.doc.assigned_members || []).map((row) => row.member_name).filter(Boolean),
		assignment_state: frm.doc.assignment_state || '',
		assignment_note: frm.doc.assignment_note || '',
	};
};

let get_dispatch_snapshot_storage_key = function (appointment) {
	if (!appointment) return '';
	return `sa_dispatch_snapshot_${appointment}`;
};

function get_local_storage_value(key) {
	try {
		return window.localStorage.getItem(key);
	} catch (e) {
		return '';
	}
}

function set_local_storage_value(key, value) {
	try {
		window.localStorage.setItem(key, value || '');
	} catch (e) {
		// ignore local storage failures
	}
}

function remove_local_storage_value(key) {
	try {
		window.localStorage.removeItem(key);
	} catch (e) {
		// ignore local storage failures
	}
}

let open_find_best_slot_dialog = function (frm) {
	open_find_best_slot_with_rules(frm);
};

let normalize_time_for_input = function (value) {
	if (!value) return '';
	const text = (value || '').toString().trim();
	const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
	if (!match) return '';
	return `${String(cint(match[1])).padStart(2, '0')}:${match[2]}`;
};

let to_backend_time_string = function (value) {
	const clean = normalize_time_for_input(value);
	if (!clean) return '';
	return `${clean}:00`;
};

let time_to_minutes = function (timeStr) {
	if (!timeStr) return 0;
	const parts = timeStr.split(':');
	return (cint(parts[0]) * 60) + cint(parts[1]);
};

let minutes_to_time_string = function (minutes) {
	minutes = Math.max(0, cint(minutes) || 0);
	const hh = Math.floor(minutes / 60) % 24;
	const mm = minutes % 60;
	return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
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
