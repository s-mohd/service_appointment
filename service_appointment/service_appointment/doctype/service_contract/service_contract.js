// Copyright (c) 2020, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt

frappe.ui.form.on('Service Contract', {
	setup(frm) {
		frappe.dynamic_link = { doc: frm.doc, fieldname: 'customer', doctype: 'Customer' }
		frm.set_query('customer_address', erpnext.queries.address_query);
		frm.set_query('customer', erpnext.queries.customer);

		frm.set_query("item", "contract_services", function (doc, cdt, cdn) {
			return {
				filters: {
					item_group: 'Services'
				}
			};
		});

		frm.get_field("visits_schedule").grid.cannot_add_rows = true;
		frm.get_field("visits_schedule").grid.only_sortable();
	},

	before_save(frm) {
		var total = 0;
		$.each(frm.doc.contract_services || [], function (i, d) {
			total += flt(d.rate);
		});
		frm.set_value("total_price", total);
	},

	customer(frm) {
		if (frm.doc.customer) {
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

	generate_schedule(frm) {
		if (frm.is_new()) {
			frappe.msgprint(__('Please save first'));
		} else {
			frm.call('generate_schedule');
		}
	},

	regenerate_schedule(frm) {
		if (frm.is_new()) {
			frappe.msgprint(__('Please save first'));
		} else {
			frm.call('regenerate_schedule');
		}
	},

	start_date: function (frm) {
		//frm.trigger('set_no_of_visits');
	},

	end_date: function (frm) {
		//frm.trigger('set_no_of_visits');
	},

	periodicity: function (frm) {
		//frm.trigger('set_no_of_visits');
	},

	set_no_of_visits: function (frm) {
		if (frm.doc.start_date && frm.doc.end_date && frm.doc.periodicity) {
			if (frm.doc.start_date > frm.doc.end_date) {
				frappe.msgprint(__("Start Date must be before End Date"));
				return;
			}

			var date_diff = frappe.datetime.get_diff(frm.doc.end_date, frm.doc.start_date) + 1;

			var days_in_period = {
				"Weekly": 7,
				"Monthly": 30,
				"Quarterly": 91,
				"Half Yearly": 182,
				"Yearly": 365
			}

			var no_of_visits = cint(date_diff / days_in_period[frm.doc.periodicity]);
			frm.set_value("no_of_visits", no_of_visits);
		}
	},

	refresh: function (frm) {
		if (frm.doc.docstatus == 1) {
			frm.add_custom_button(__("Generate Invoice"), function () {
				if (frm.doc.total_price) {
					frappe.model.open_mapped_doc({
						method: "service_appointment.service_appointment.doctype.service_contract.service_contract.make_invoice",
						frm: frm
					});
				}
			});

			frm.add_custom_button(__("Link Visit Schedules"), function () {
				if (frm.doc.visits_schedule) {
					frm.call({
						method: "link_visit_schedules",
						doc: frm.doc,
						callback: function() {
							frm.refresh();
						}
					});
				}
			});
			if (frm.doc.contract_status == "Active") {
				frm.add_custom_button(__("Terminate"), function () {
					frappe.confirm(
						'Terminate Contract?',
						function () {
							frappe.confirm(
								'Delete uncompleted appointments?',
								function () {
									frm.call({
										method: "terminate_contract",
										args: { delete_draft: true },
										doc: frm.doc,
										callback: function() {
											frm.refresh();
										}
									});
								},
		
								function () {
									frm.call({
										method: "terminate_contract",
										args: { delete_draft: false },
										doc: frm.doc,
										callback: function() {
											frm.refresh();
										}
									});
								}
							);
						}
					);
				});
			}
		}

		if (frm.doc.docstatus == 1 && frm.doc.contract_status == "Expired") {
			frm.add_custom_button(__("Renew"), function () {
				frappe.model.open_mapped_doc({
					method: "service_appointment.service_appointment.doctype.service_contract.service_contract.renew",
					frm: frm
				});
			});
		}
	}
});
