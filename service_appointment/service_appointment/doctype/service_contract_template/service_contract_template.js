// Copyright (c) 2020, Sayed Hameed Ebrahim and contributors
// For license information, please see license.txt

frappe.ui.form.on('Service Contract Template', {
	setup: function (frm) {
		frm.get_field("visit_details").grid.cannot_add_rows = true;
		frm.get_field("visit_details").grid.only_sortable();
	},

	no_of_visits(frm) {
		frm.set_value('visit_details', []);
		if (frm.doc.no_of_visits) {
			for (var i = 0; i < frm.doc.no_of_visits; i++) {
				frappe.model.add_child(frm.doc, "Service Contract Template Item", 'visit_details');
			}
		}

		frm.refresh_field('visit_details');
	},
	// refresh: function(frm) {

	// }
});
