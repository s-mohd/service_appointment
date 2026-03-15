// frappe.provide('frappe.contact_log');
frappe.pages['contact-log'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Contact Log'
	});

	this.contact_log = new ContactLog(wrapper);
	$(wrapper).bind('show', () => {
		this.contact_log.show();
	});
}

class ContactLog {
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = wrapper.page;
		this.sidebar = this.wrapper.find('.layout-side-section');
		this.main_section = this.wrapper.find('.layout-main-section');
		this.start = 0;
		this.set_from_route();
	}

	show() {
		frappe.breadcrumbs.add('Selling');
		this.sidebar.empty();

		let me = this;

		// On customer set, show customer profile and set customer in route options
		let customer = frappe.ui.form.make_control({
			parent: me.sidebar,
			df: {
				fieldtype: 'Link',
				options: 'Customer',
				fieldname: 'customer',
				placeholder: __('Select Customer'),
				change: () => {
					me.contact_id = '';
					if (me.contact_id != customer.get_value() && customer.get_value()) {
						me.start = 0;
						me.contact_id = customer.get_value();
						frappe.set_route('contact-log', me.contact_id, me.mobile_no);
						me.make_customer_profile();
					}
				}
			}
		});
		customer.refresh();
		customer.set_value(this.contact_id);

		me.mobile_no_field = frappe.ui.form.make_control({
			parent: me.sidebar,
			df: {
				fieldtype: 'Data',
				fieldname: 'mobile_no',
				placeholder: __('Mobile Number'),
				change: () => {
					customer.set_value('');
					me.empty_html();
					if (me.mobile_no_field.get_value()) {
						me.mobile_no = me.mobile_no_field.get_value();
						frappe.call({
							method: 'frappe.client.get_value',
							args: {
								doctype: 'Customer',
								fieldname: 'name',
								filters: { mobile_no: me.mobile_no_field.get_value() }
							},
							callback: function (r) {
								me.contact_id = '';
								if (r.message && "name" in r.message) {
									me.mobile_no = me.mobile_no_field.get_value();
									me.contact_id = r.message.name;
									frappe.set_route('contact-log', r.message.name, me.mobile_no_field.get_value());
								}
							}
						});
					}
				}
			}
		});
		me.mobile_no_field.refresh();
		me.mobile_no_field.set_value(this.mobile_no);

		// this.page.add_action_item(__('Send Location'), function() {
		// 	me.show_send_location_dialog();
		// },);

		// // New Service Appointment button, pass customer name
		// this.page.add_action_item(__('New Service Appointment'), function() {
		// 	frappe.new_doc('Service Appointment', {customer: me.contact_id});
		// });

		// this.page.add_action_item(__('New Delivery Note'), function() {
		// 	frappe.new_doc('Delivery Note', {customer: me.contact_id});
		// });

		// this.page.add_action_item(__('New Quotation'), function() {
		// 	frappe.new_doc('Quotation', {
		// 		qutation_to: 'Customer',
		// 		party_name: me.contact_id
		// 	});
		// });

		// New Contact Log button
		this.page.set_primary_action(__('New Contact Log'), function () {
			me.show_new_contact_dialog();
		}, 'add', 'btn-primary');



		if (frappe.route_options && !this.contact_id) {
			customer.set_value(frappe.route_options.contact);
			this.contact_id = frappe.route_options.contact;
		}

		this.sidebar.find('[data-fieldname="customer"]').append('<div class="contact-info"></div>');
	}

	show_send_location_dialog() {
		let me = this;
		let dialog = new frappe.ui.Dialog({
			title: __('Send Location'),
			fields: [
				{
					fieldname: 'branch_1',
					fieldtype: 'Button',
					label: __('Hamad Town'),
					click: () => {
						me.send_location_message('Hamad Town');
						dialog.hide();
					}
				},
				{
					fieldname: 'branch_2',
					fieldtype: 'Button',
					label: __('Al Qadam'),
					click: () => {
						me.send_location_message('Al Qadam');
						dialog.hide();
					}
				},
				// {
				// 	fieldname: 'branch_3',
				// 	fieldtype: 'Button',
				// 	label: __('Branch 3'),
				// 	click: () => {
				// 		me.send_location_message('Branch 3');
				// 		dialog.hide();
				// 	}
				// }
			]
		});
		dialog.show();
	}

	send_location_message(branch) {
		let mobile = "";
		if (this.contact_id) {
			mobile = $(`.customer-mobile-no`).html();
		} else {
			mobile = (this.mobile_no_field.get_value() ? this.mobile_no_field.get_value() : "");
		}

		let maps_url = "";
		if (branch == 'Hamad Town') {
			maps_url = "https://maps.app.goo.gl/mamHquTtrmZtofpt8";
		} else if (branch == 'Al Qadam') {
			maps_url = "https://maps.app.goo.gl/8X1vyZXuotr8dmoU7";
		}

		frappe.confirm('Send Whatsapp to ' + mobile + ' ?', function () {
			var message = `شكراً لاختياركم القلاف\n`;
			message += `الرابط المرفق يحتوي على موقعنا في ${branch}\n`;
			message += `${maps_url}\n`;

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

	empty_html() {
		this.sidebar.find('.contact-info').empty();
		this.main_section.find('.contact_documents_list').empty();
	}

	make_customer_profile() {
		this.page.set_title(__('Contact Log'));
		this.main_section.empty().append(frappe.render_template('contact_log'));
		this.setup_filters();
		this.setup_documents();
		this.show_contact_info();
	}

	set_from_route() {
		this.contact_id = '';
		let route = frappe.get_route();
		if (route.length == 2) {
			this.contact_id = route[1];
		} else if (route.length == 3) {
			this.contact_id = route[1];
			this.mobile_no = route[2];
		}
	}

	setup_filters() {
		$('.doctype-filter').empty();
		let me = this;

		frappe.xcall(
			'service_appointment.service_appointment.page.contact_log.contact_log.get_contact_log_doctypes'
		).then(document_types => {
			let doctype_filter = frappe.ui.form.make_control({
				parent: $('.doctype-filter'),
				df: {
					fieldtype: 'MultiSelectList',
					fieldname: 'document_type',
					placeholder: __('Select Document Type'),
					change: () => {
						me.start = 0;
						me.page.main.find('.contact_documents_list').html('');
						this.setup_documents(doctype_filter.get_value(), date_range_field.get_value());
					},
					get_data: () => {
						return document_types.map(document_type => {
							return {
								description: document_type,
								value: document_type
							};
						});
					},
				}
			});
			doctype_filter.refresh();

			$('.date-filter').empty();
			let date_range_field = frappe.ui.form.make_control({
				df: {
					fieldtype: 'DateRange',
					fieldname: 'date_range',
					placeholder: __('Date Range'),
					input_class: 'input-xs',
					change: () => {
						let selected_date_range = date_range_field.get_value();
						if (selected_date_range && selected_date_range.length === 2) {
							me.start = 0;
							me.page.main.find('.contact_documents_list').html('');
							this.setup_documents(doctype_filter.get_value(), date_range_field.get_value());
						}
					}
				},
				parent: $('.date-filter')
			});
			date_range_field.refresh();
		});
	}

	setup_documents(document_types = "", selected_date_range = "") {
		let filters = {
			name: this.contact_id,
			start: this.start,
			page_length: 20
		};
		if (document_types)
			filters['document_types'] = document_types;
		if (selected_date_range)
			filters['date_range'] = selected_date_range;

		let me = this;
		frappe.call({
			'method': 'service_appointment.service_appointment.page.contact_log.contact_log.get_feed',
			args: filters,
			callback: function (r) {
				let data = r.message;
				if (data.length) {
					me.add_to_records(data);
				} else {
					me.page.main.find('.contact_documents_list').append(`
						<div class='text-muted' align='center'>
							<br><br>${__('No more records..')}<br><br>
						</div>`);
				}
			}
		});
	}

	add_to_records(data) {
		let me = this;
		let details = "";
		let i;
		for (i = 0; i < data.length; i++) {
			if (data[i].doctype) {
				let actions = this.get_doctype_actions(data[i].doctype, data[i].name);
				data[i] = this.add_date_separator(data[i]);
				let time_line_heading = data[i].owner ? `${frappe.user_info(data[i].owner).fullname} ` : ``;
				if (frappe.user_info(data[i].owner).image) {
					data[i].imgsrc = frappe.utils.get_file_link(frappe.user_info(data[i].owner).image);
				} else {
					data[i].imgsrc = false;
				}
				if (data[i].imgsrc) {
					details += `
						<div class="avatar-frame standard-image" style="background-color: var(--dark-green-avatar-bg); color: var(--dark-green-avatar-color)">
							<img class='avatar-frame' src='${data[i].imgsrc}' width='32' height='32'></img>
						</div>`;
				} else {
					details += `<span class='mr-3 avatar avatar-small' style='width:32px; height:32px;'>
						<div class="avatar-frame standard-image" style="background-color: var(--dark-green-avatar-bg); color: var(--dark-green-avatar-color)">
							${frappe.user_info(data[i].owner).fullname ? data[i].owner.charAt(0) : 'U'}
						</div>
					</span>`;
				}
				details += `<div style="display:inline;">${time_line_heading}</div>`;
				details += `
					<div class="widget dashboard-widget-box mt-2 mb-3" style="height:unset; min-height:unset;">
						<div class="widget-head">
							<div class="widget-label">
								<div class="widget-title" title="${data[i].doctype}">
									<span class="ellipsis ${data[i]._color}" title="${data[i].doctype}">
										${data[i].doctype} 
										<a class='link' style='color:blue' onclick="frappe.open_in_new_tab = true; frappe.set_route('Form', '${data[i].doctype}', '${data[i].name}');">${data[i].name}</a>
									</span>
								</div>
								<div class="widget-subtitle">
									<span>${data[i].date_sep}</span>
								</div>
							</div>
							${actions}
						</div>
						<div class="widget-body" id="${data[i].name}">
						</div>
						<div class="widget-footer"></div>
					</div>
				`;
			}
		}

		this.page.main.find('.contact_documents_list').append(details);
		for (i = 0; i < data.length; i++) {
			if (data[i].doctype) {
				this.get_document_body(data[i]);
			}
		}
		this.start += data.length;
	}

	get_doctype_actions(doctype, docname) {
		let actions = "";
		if (doctype == "Contact Log Record") {
			actions = `
				<div class="dropdown">
					<button class="btn btn-secondary btn-xs dropdown-toggle" type="button" id="dropdownMenuButton" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
						Actions
					</button>
					<div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
						<a class="dropdown-item contact-log-action" data-contact-log-record="${docname}" data-action="send_location" href="#">Send Location</a>
						<a class="dropdown-item contact-log-action" data-contact-log-record="${docname}" data-action="new_service_appointment" href="#">New Service Appointment</a>
						<a class="dropdown-item contact-log-action" data-contact-log-record="${docname}" data-action="new_delivery_note" href="#">New Delivery Note</a>
						<a class="dropdown-item contact-log-action" data-contact-log-record="${docname}" data-action="new_quotation" href="#">New Quotation</a>
					</div>
				</div>
			`;
		}
		return actions;
	}

	get_document_body(data) {
		if (data.doctype == 'Service Appointment') {
			// create a new field group and return the html
			let field_group = new frappe.ui.FieldGroup({
				parent: $(`#${data.name}`),
				fields: [
					{ fieldname: 'service_type', fieldtype: 'Data', label: __('Service Type'), default: data.service_type, read_only: 1 },
					{ fieldname: 'guarantee', fieldtype: 'Data', label: __('Guarantee'), default: `${data.guarantee_qty} ${data.guarantee_uom}`, description: `<span class="${(data._is_valid == 'Valid' ? 'text-success' : 'text-danger')}">${data._is_valid}</span>`, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'appointment_status', fieldtype: 'Data', label: __('Appointment Status'), default: data.appointment_status, read_only: 1 },
					{ fieldname: 'expiry_date', fieldtype: 'Date', label: __('Expiry Date'), default: data.expiry_date, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'total_amount', fieldtype: 'Currency', label: __('Total Amount'), default: data.total_amount, read_only: 1 },
				]
			});
			field_group.make();
		} else if (data.doctype == 'Sales Invoice') {
			// fields = ["grand_total", "outstanding_amount", "status"]
			let field_group = new frappe.ui.FieldGroup({
				parent: $(`#${data.name}`),
				fields: [
					{ fieldname: 'grand_total', fieldtype: 'Currency', label: __('Grand Total'), default: data.grand_total, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'status', fieldtype: 'Data', label: __('Status'), default: data.status, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'outstanding_amount', fieldtype: 'Currency', label: __('Outstanding Amount'), default: data.outstanding_amount, read_only: 1 },
				]
			});
			field_group.make();
		} else if (data.doctype == 'Delivery Note') {
			// fields = "grand_total", "workflow_state", "status"
			let field_group = new frappe.ui.FieldGroup({
				parent: $(`#${data.name}`),
				fields: [
					{ fieldname: 'grand_total', fieldtype: 'Currency', label: __('Grand Total'), default: data.grand_total, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'status', fieldtype: 'Data', label: __('Status'), default: data.status, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'workflow_state', fieldtype: 'Data', label: __('Workflow State'), default: data.workflow_state, read_only: 1 },
				]
			});
			field_group.make();
		} else if (data.doctype == 'Quotation') {
			// fields = "grand_total", "status"
			let field_group = new frappe.ui.FieldGroup({
				parent: $(`#${data.name}`),
				fields: [
					{ fieldname: 'grand_total', fieldtype: 'Currency', label: __('Grand Total'), default: data.grand_total, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'status', fieldtype: 'Data', label: __('Status'), default: data.status, read_only: 1 }
				]
			});
			field_group.make();
		} else if (data.doctype == 'Sales Order') {
			// fields = "grand_total", "status"
			let field_group = new frappe.ui.FieldGroup({
				parent: $(`#${data.name}`),
				fields: [
					{ fieldname: 'grand_total', fieldtype: 'Currency', label: __('Grand Total'), default: data.grand_total, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'status', fieldtype: 'Data', label: __('Status'), default: data.status, read_only: 1 }
				]
			});
			field_group.make();
		} else if (data.doctype == 'Payment Entry') {
			// fields = "paid_amount", "status", "mode_of_payment"
			let field_group = new frappe.ui.FieldGroup({
				parent: $(`#${data.name}`),
				fields: [
					{ fieldname: 'paid_amount', fieldtype: 'Currency', label: __('Paid Amount'), default: data.paid_amount, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'mode_of_payment', fieldtype: 'Data', label: __('Mode of Payment'), default: data.mode_of_payment, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'status', fieldtype: 'Data', label: __('Status'), default: data.status, read_only: 1 }
				]
			});
			field_group.make();
		} else if (data.doctype == 'Contact Log Record') {
			// fields = "contact_name", "contact_channel", "contact_time", "notes"
			let field_group = new frappe.ui.FieldGroup({
				parent: $(`#${data.name}`),
				fields: [
					{ fieldname: 'contact_time', fieldtype: 'Datetime', label: __('Contact Time'), default: data.contact_time, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'contact_channel', fieldtype: 'Data', label: __('Contact Channel'), default: data.contact_channel, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'contact_name', fieldtype: 'Data', label: __('Contact Name'), default: data.contact_name, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldname: 'notes', fieldtype: 'Small Text', label: __('Notes'), default: data.notes, read_only: 1 },
				]
			});
			field_group.make();
		}
	}

	add_date_separator(data) {
		let date = frappe.datetime.str_to_obj(data._date);
		let pdate = '';
		let diff = frappe.datetime.get_day_diff(frappe.datetime.get_today(),
			frappe.datetime.obj_to_str(date));

		if (diff < 1) {
			pdate = __('Today');
		} else if (diff < 2) {
			pdate = __('Yesterday');
		} else {
			pdate = __('{0}', [frappe.datetime.global_date_format(date)]);
		}
		data.date_sep = pdate;
		return data;
	}

	show_contact_info() {
		this.get_contact_info().then(() => {
			$('.contact-info').empty().append(frappe.render_template('contact_log_sidebar', {
				customer_name: this.contact.customer_name,
				customer_mobile: this.contact.mobile_no,
				customer_address: this.contact.customer_primary_address
			}));
		});
	}

	get_contact_info() {
		return frappe.xcall('frappe.client.get', {
			doctype: 'Customer',
			name: this.contact_id,
		}).then((customer) => {
			if (customer) {
				this.contact = customer;
			}
		});
	}

	show_new_contact_dialog() {
		let me = this;
		frappe.call(
			{
				method: 'frappe.client.get_list',
				args: {
					doctype: 'Contact Reason',
					fields: ['name', 'contact_reason']
				}
			}
		).then((contact_reasons) => {
			let dialog = new frappe.ui.Dialog({
				title: __('New Contact Log'),
				fields: [
					{
						fieldname: 'contact_time',
						fieldtype: 'Datetime',
						label: __('Contact Time'),
						default: frappe.datetime.now_datetime(),
						reqd: 1
					},
					{
						fieldname: 'customer',
						fieldtype: 'Link',
						options: 'Customer',
						label: __('Customer'),
						default: (me.contact_id ? me.contact_id : ""),
					},
					{
						fieldname: 'contact_name',
						fieldtype: 'Data',
						label: __('Contact Name'),
						default: (me.mobile_no ? me.mobile_no : "")
					},
					{
						fieldname: 'contact_channel',
						fieldtype: 'Select',
						label: __('Contact Channel'),
						options: ['Phone', 'Whatsapp', 'Instagram', 'Email', 'Website', 'In Person', 'Tiktok'],
						default: 'Phone',
						reqd: 1
					},
					{
						fieldname: 'reason',
						fieldtype: 'MultiSelectList',
						label: __('Reason'),
						reqd: 1,
						get_data: () => {
							return contact_reasons.message.map(contact_reason => {
								return {
									description: contact_reason.contact_reason,
									value: contact_reason.name
								};
							});
						}
					},
					{
						fieldname: 'notes',
						fieldtype: 'Small Text',
						label: __('Notes')
					}
				],
				primary_action_label: __('Save'),
				primary_action: function () {
					let values = dialog.get_values();
					if (!values) return;
					me.save_contact_log(values);
					dialog.hide();
				}
			});
			dialog.show();
		});
	}

	save_contact_log(values) {
		let me = this;
		let data = {
			customer: values.customer,
			contact_name: values.contact_name,
			contact_channel: values.contact_channel,
			contact_time: values.contact_time,
			notes: values.notes
		}
		frappe.call({
			method: 'service_appointment.service_appointment.page.contact_log.contact_log.save_contact_log',
			args: {
				doc: data,
				reasons: values.reason
			},
			callback: function (r) {
				if (r.message) {
					frappe.show_alert({
						message: __('Contact Log saved successfully'),
						indicator: 'green'
					});
					me.show();
				}
			}
		});
	}
}

function show_send_location_dialog(contact_id, mobile_no) {
	let dialog = new frappe.ui.Dialog({
		title: __('Send Location'),
		fields: [
			{
				fieldname: 'branch_1',
				fieldtype: 'Button',
				label: __('Hamad Town'),
				click: () => {
					send_location_message('Hamad Town');
					dialog.hide();
				}
			},
			{
				fieldname: 'branch_2',
				fieldtype: 'Button',
				label: __('Al Qadam'),
				click: () => {
					send_location_message('Al Qadam');
					dialog.hide();
				}
			}
		]
	});
	dialog.show();
}

function send_location_message(branch, contact_id, mobile_no = "") {
	let mobile = "";
	if (contact_id) {
		mobile = $(`.customer-mobile-no`).html();
	} else {
		mobile = (mobile_no ? mobile_no : "");
	}

	let maps_url = "";
	if (branch == 'Hamad Town') {
		maps_url = "https://maps.app.goo.gl/mamHquTtrmZtofpt8";
	} else if (branch == 'Al Qadam') {
		maps_url = "https://maps.app.goo.gl/8X1vyZXuotr8dmoU7";
	}

	frappe.confirm('Send Whatsapp to ' + mobile + ' ?', function () {
		var message = `شكراً لاختياركم القلاف\n`;
		message += `الرابط المرفق يحتوي على موقعنا في ${branch}\n`;
		message += `${maps_url}\n`;

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

$(document).on('click', '.contact-log-action', function () {
	let action = $(this).attr('data-action');
	let contact_log_record = $(this).attr('data-contact-log-record');
	let contact_id = frappe.pages['contact-log'].contact_log.contact_id;
	let mobile_no = frappe.pages['contact-log'].contact_log.mobile_no;

	if (action == 'send_location') {
		show_send_location_dialog(contact_id, mobile_no);
	} else if (action == 'new_service_appointment') {
		frappe.new_doc('Service Appointment', { customer: contact_id, contact_log_record: contact_log_record });
	} else if (action == 'new_delivery_note') {
		frappe.new_doc('Delivery Note', { customer: contact_id, contact_log_record: contact_log_record });
	} else if (action == 'new_quotation') {
		frappe.new_doc('Quotation', { qutation_to: 'Customer', party_name: contact_id, contact_log_record: contact_log_record });
	}
});
