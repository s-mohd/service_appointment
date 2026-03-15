frappe.pages['service-team-schedule'].on_page_load = function (wrapper) {
	var me = this;
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Service Team Schedule',
		single_column: true
	});

	frappe.breadcrumbs.add("Alqallaf");


	this.date_range = page.add_field({
		fieldtype: 'DateRange',
		fieldname: 'selected_date_range',
		label: __("Date Range"),
		placeholder: "Date Range",
		default: [frappe.datetime.month_start(), frappe.datetime.month_end()],
		input_class: 'input-sm',
		reqd: 1
	});

	this.show_schedule = page.add_field({
		fieldname: "show_schedule",
		label: __("Show Schedule"),
		fieldtype: "Button",
		click: (e) => {
			var errors = [];

			if (!this.date_range.value) {
				errors.push('- Date Range');
			}

			if (errors.length > 0) {
				frappe.msgprint("Please enter:<br>" + errors.join("<br>"), "Error");
			} else {
				show_schedule(this.date_range.value);
			}

		}
	});

	this.update = page.add_field({
		fieldname: "update",
		label: __("Update"),
		fieldtype: "Button",
		click: (e) => {
			var changed_data = [];

			$('.checkboxes').each(function (i, e) {
				var date = $(e).data('date');
				var team = $(e).data('team');
				var hour = $(e).data('hour');
				var new_value = e.checked;

				if ($(e).data('value') != e.checked) {
					changed_data.push({
						date: $(e).data('date'),
						team: $(e).data('team'),
						hour: $(e).data('hour'),
						value: (e.checked ? 1 : 0)
					});
				}
			});

			frappe.call({
				"method": "service_appointment.service_appointment.page.service_team_schedule.service_team_schedule.update_schedule",
				args: {
					data: changed_data
				},
				freeze: true,
				freeze_message: __("Updating Schedule..."),
				callback: function (r) {
					if (r.message) {
						frappe.show_alert({ message: __(r.message), indicator: 'green' });
					}
					show_schedule(cur_page.page.date_range.value);
				}
			});
		}
	});

	this.show_schedule.$input.addClass('btn-info');
	this.update.$input.addClass('btn-primary');
};

var show_schedule = function (date_range) {
	frappe.call({
		"method": "service_appointment.service_appointment.page.service_team_schedule.service_team_schedule.get_schedule_records",
		args: {
			date_range: date_range
		},
		freeze: true,
		freeze_message: __("Getting Schedule..."),
		callback: function (r) {
			var data = r.message;
			var hours = [
				{ name: 'hour_00', hour: '00' },
				{ name: 'hour_01', hour: '01' },
				{ name: 'hour_02', hour: '02' },
				{ name: 'hour_03', hour: '03' },
				{ name: 'hour_04', hour: '04' },
				{ name: 'hour_05', hour: '05' },
				{ name: 'hour_06', hour: '06' },
				{ name: 'hour_07', hour: '07' },
				{ name: 'hour_08', hour: '08' },
				{ name: 'hour_09', hour: '09' },
				{ name: 'hour_10', hour: '10' },
				{ name: 'hour_11', hour: '11' },
				{ name: 'hour_12', hour: '12' },
				{ name: 'hour_13', hour: '13' },
				{ name: 'hour_14', hour: '14' },
				{ name: 'hour_15', hour: '15' },
				{ name: 'hour_16', hour: '16' },
				{ name: 'hour_17', hour: '17' },
				{ name: 'hour_18', hour: '18' },
				{ name: 'hour_19', hour: '19' },
				{ name: 'hour_20', hour: '20' },
				{ name: 'hour_21', hour: '21' },
				{ name: 'hour_22', hour: '22' },
				{ name: 'hour_23', hour: '23' }
			];

			var html = frappe.render_template('service_team_schedule', {
				data: data,
				hours: hours
			});

			$('.layout-footer').removeClass('hide');
			$('.layout-footer').html(html);
		}
	});
};

$(document).on('click', '.check-all', function () {
	if ($(this).prop("checked") == true) {
		$(this).parents('tr').find('.checkboxes').prop("checked", "checked");
	} else if ($(this).prop("checked") == false) {
		$(this).parents('tr').find('.checkboxes').prop("checked", "");
	}
});