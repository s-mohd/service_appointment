const SA_CAL_VIEW_CALENDAR_TARGET_DATE_KEY = 'sa_calendar_target_date';
const SA_CAL_VIEW_ASSIGNMENT_TARGET_DATE_KEY = 'sa_assignment_target_date';
const SA_CAL_VIEW_TECHNICIAN_TARGET_DATE_KEY = 'sa_technician_target_date';

frappe.views.calendar['Service Appointment'] = {
	field_map: {
		start: 'start',
		end: 'end',
		id: 'name',
		title: 'title',
		allDay: 'allDay',
		eventColor: 'color',
	},
	order_by: 'date',
	gantt: true,
	get_events_method: 'service_appointment.service_appointment.doctype.service_appointment.service_appointment.get_events',
	editable: false,
	selectable: false,
	options: {
		viewRender: function () {
			add_switch_buttons();
			apply_calendar_target_date_once();
		},
	},
};

function add_switch_buttons() {
	if (!window.cur_list || !cur_list.page || cur_list.doctype !== 'Service Appointment') return;
	if (cur_list.page.__sa_calendar_switch_buttons_added) return;
	cur_list.page.__sa_calendar_switch_buttons_added = true;

	cur_list.page.add_inner_button(__('Member Assignment'), () => {
		const focus_date = get_calendar_focus_date();
		set_local_storage_value(SA_CAL_VIEW_ASSIGNMENT_TARGET_DATE_KEY, focus_date);
		frappe.set_route('service-assignment-workstation');
	});
	cur_list.page.add_inner_button(__('Technician Services'), () => {
		const focus_date = get_calendar_focus_date();
		set_local_storage_value(SA_CAL_VIEW_TECHNICIAN_TARGET_DATE_KEY, focus_date);
		frappe.set_route('technician-services');
	});
}

function apply_calendar_target_date_once() {
	const target_date = get_local_storage_value(SA_CAL_VIEW_CALENDAR_TARGET_DATE_KEY);
	if (!target_date) return;

	const $cal = get_calendar_widget();
	if (!$cal || !$cal.length) return;

	remove_local_storage_value(SA_CAL_VIEW_CALENDAR_TARGET_DATE_KEY);
	$cal.fullCalendar('gotoDate', target_date);
}

function get_calendar_focus_date() {
	const $cal = get_calendar_widget();
	if (!$cal || !$cal.length) return frappe.datetime.now_date();

	try {
		const date_obj = $cal.fullCalendar('getDate');
		if (date_obj && date_obj.format) {
			return date_obj.format('YYYY-MM-DD');
		}
	} catch (e) {
		// ignore and use fallback
	}
	return frappe.datetime.now_date();
}

function get_calendar_widget() {
	try {
		if (window.cur_list && cur_list.calendar && cur_list.calendar.$cal) {
			return cur_list.calendar.$cal;
		}
	} catch (e) {
		// ignore access errors
	}
	return null;
}

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
