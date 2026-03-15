frappe.provide('service_appointment');

const TECHNICIAN_CALENDAR_TARGET_DATE_KEY = 'sa_calendar_target_date';
const TECHNICIAN_PAGE_TARGET_DATE_KEY = 'sa_technician_target_date';
const TECHNICIAN_ASSIGNMENT_TARGET_DATE_KEY = 'sa_assignment_target_date';

frappe.pages['technician-services'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Technician Services'),
		single_column: true,
	});

	frappe.breadcrumbs.add('Service Appointment');
	new service_appointment.TechnicianServicesPage(page);
};

service_appointment.TechnicianServicesPage = class TechnicianServicesPage {
	constructor(page) {
		this.page = page;
		this.filters = {
			date: this.consume_target_date() || frappe.datetime.now_date(),
			days: 7,
		};
		this.data = {
			technician: {},
			overdue: [],
			today: [],
			upcoming: [],
			reason_options: [],
		};
		this.rows_by_name = {};

		this.ensure_styles();
		this.make_body();
		this.setup_navigation_actions();
		this.bind_events();
		this.refresh();
	}

	ensure_styles() {
		if ($('#sa-technician-services-style').length) return;

		$('head').append(`
			<style id="sa-technician-services-style">
				.ts-root {
					padding: 8px 0 12px;
					max-width: 1280px;
				}
				.ts-toolbar {
					display: flex;
					align-items: center;
					gap: 8px;
					flex-wrap: wrap;
					margin-bottom: 10px;
				}
				.ts-date-control {
					max-width: 170px;
				}
				.ts-date-control .frappe-control {
					margin-bottom: 0;
				}
				.ts-date-control .control-input-wrapper input {
					height: 34px;
					font-size: 13px;
				}
				.ts-meta {
					display: flex;
					gap: 8px;
					flex-wrap: wrap;
					margin: 8px 0 12px;
				}
				.ts-pill {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					padding: 4px 10px;
					border-radius: 999px;
					background: var(--gray-100);
					font-size: 12px;
					font-weight: 600;
				}
				.ts-pill.red {
					background: rgba(229, 83, 83, 0.12);
					color: #8f2323;
				}
				.ts-section {
					margin-bottom: 14px;
				}
				.ts-section-title {
					font-size: 14px;
					font-weight: 700;
					margin-bottom: 8px;
				}
				.ts-grid {
					display: grid;
					grid-template-columns: repeat(2, minmax(0, 1fr));
					gap: 10px;
				}
				.ts-card {
					border: 1px solid var(--border-color);
					border-radius: 10px;
					background: var(--fg-color);
					padding: 10px;
				}
				.ts-card.overdue {
					border-color: #e55353;
					background: rgba(229, 83, 83, 0.06);
				}
				.ts-head {
					display: flex;
					align-items: flex-start;
					justify-content: space-between;
					gap: 8px;
				}
				.ts-title {
					font-size: 13px;
					font-weight: 700;
					line-height: 1.3;
				}
				.ts-subtitle {
					font-size: 11px;
					color: var(--text-muted);
				}
				.ts-status {
					font-size: 11px;
					padding: 2px 8px;
					border-radius: 999px;
					font-weight: 700;
					white-space: nowrap;
				}
				.ts-status.green { background: rgba(46, 174, 109, 0.15); color: #1f6f46; }
				.ts-status.blue { background: rgba(10, 124, 255, 0.15); color: #0a4e99; }
				.ts-status.orange { background: rgba(245, 159, 0, 0.20); color: #825300; }
				.ts-status.red { background: rgba(229, 83, 83, 0.20); color: #a12626; }
				.ts-status.gray { background: rgba(140, 140, 140, 0.16); color: #444; }
				.ts-row {
					margin-top: 6px;
					font-size: 12px;
					line-height: 1.4;
				}
				.ts-collect {
					margin-top: 7px;
					font-size: 12px;
					font-weight: 700;
					padding: 6px 8px;
					border-radius: 8px;
				}
				.ts-collect.yes { background: rgba(229, 83, 83, 0.12); color: #a12626; }
				.ts-collect.no { background: rgba(46, 174, 109, 0.12); color: #1f6f46; }
				.ts-assigned {
					margin-top: 6px;
					font-size: 11px;
					font-weight: 600;
					color: var(--text-muted);
				}
				.ts-actions {
					display: flex;
					gap: 6px;
					margin-top: 8px;
					flex-wrap: wrap;
				}
				.ts-actions .btn {
					border-radius: 8px;
				}
				.ts-empty {
					border: 1px dashed var(--border-color);
					border-radius: 10px;
					padding: 12px;
					font-size: 12px;
					color: var(--text-muted);
				}
				.ts-step-title {
					font-size: 12px;
					font-weight: 700;
					margin-bottom: 4px;
				}
				.ts-step-desc {
					font-size: 11px;
					color: var(--text-muted);
					margin-bottom: 6px;
				}
				.ts-wizard-progress {
					display: flex;
					gap: 6px;
					flex-wrap: wrap;
					margin-bottom: 8px;
				}
				.ts-wizard-chip {
					font-size: 11px;
					font-weight: 600;
					padding: 4px 8px;
					border-radius: 999px;
					background: var(--gray-100);
					color: var(--text-muted);
				}
				.ts-wizard-chip.active {
					background: rgba(10, 124, 255, 0.14);
					color: #0a4e99;
				}
				.ts-wizard-chip.done {
					background: rgba(46, 174, 109, 0.16);
					color: #1f6f46;
				}
				.ts-complete-wizard-dialog .modal-dialog {
					width: 94vw;
					max-width: 900px;
				}
				.ts-complete-wizard-dialog .modal-body {
					max-height: 72vh;
					overflow-y: auto;
				}
				.ts-complete-wizard-dialog .modal-footer {
					position: sticky;
					bottom: 0;
					background: var(--fg-color);
					border-top: 1px solid var(--border-color);
					z-index: 2;
				}
				@media (max-width: 991px) {
					.ts-grid { grid-template-columns: 1fr; }
				}
				@media (max-width: 430px) {
					.ts-toolbar { gap: 6px; }
					.ts-toolbar .btn { padding: 6px 10px; }
					.ts-card { padding: 9px; }
					.ts-actions .btn { flex: 1 1 auto; min-width: 120px; }
					.ts-status { font-size: 10px; }
					.ts-complete-wizard-dialog .modal-dialog {
						width: 100vw;
						max-width: 100vw;
						margin: 0;
						height: 100vh;
					}
					.ts-complete-wizard-dialog .modal-content {
						height: 100vh;
						border-radius: 0;
					}
					.ts-complete-wizard-dialog .modal-body {
						max-height: calc(100vh - 118px);
						overflow-y: auto;
						padding-bottom: 16px;
					}
				}
			</style>
		`);
	}

	make_body() {
		this.page.main.find('.ts-root').remove();
		const root = $(`
			<div class="ts-root">
				<div class="ts-toolbar">
					<div class="ts-date-control"></div>
					<button type="button" class="btn btn-default btn-sm btn-ts-today">${__('Today')}</button>
					<button type="button" class="btn btn-primary btn-sm btn-ts-refresh">${__('Refresh')}</button>
				</div>
				<div class="ts-meta"></div>
				<div class="ts-sections"></div>
			</div>
		`);

		root.appendTo(this.page.main);
		this.root = root;
		this.meta_wrapper = root.find('.ts-meta');
		this.sections_wrapper = root.find('.ts-sections');

		this.date_control = frappe.ui.form.make_control({
			parent: root.find('.ts-date-control'),
			df: {
				fieldtype: 'Date',
				fieldname: 'date_from',
				placeholder: __('Date'),
			},
			only_input: true,
			render_input: true,
		});
		this.date_control.refresh();
		this.date_control.set_value(this.filters.date);
	}

	setup_navigation_actions() {
		this.page.add_inner_button(__('Service Appointment Calendar'), () => this.go_to_calendar());
		this.page.add_inner_button(__('Member Assignment'), () => this.go_to_assignment());
	}

	bind_events() {
		this.root.on('click', '.btn-ts-refresh', () => this.refresh());
		this.root.on('click', '.btn-ts-today', () => {
			this.filters.date = frappe.datetime.now_date();
			this.date_control.set_value(this.filters.date);
			this.refresh();
		});

		this.date_control.$input.on('change', () => {
			const value = this.date_control.get_value();
			if (!value) return;
			this.filters.date = value;
			this.refresh();
		});

		this.root.on('click', '.btn-ts-map', (e) => {
			const $btn = $(e.currentTarget);
			if ($btn.hasClass('disabled')) return;
			const url = $btn.data('url');
			if (!url) {
				frappe.msgprint(__('No location found for this service.'));
				return;
			}
			window.open(url, '_blank');
		});

		this.root.on('click', '.btn-ts-start', (e) => {
			const appointment = $(e.currentTarget).data('name');
			this.start_service(appointment);
		});

		this.root.on('click', '.btn-ts-complete', (e) => {
			const appointment = $(e.currentTarget).data('name');
			const row = this.get_row(appointment);
			if (!row) return;
			this.open_complete_wizard(row);
		});

		this.root.on('click', '.btn-ts-no-start', (e) => {
			const appointment = $(e.currentTarget).data('name');
			this.open_no_start_dialog(appointment);
		});
	}

	go_to_calendar() {
		set_local_storage_value(TECHNICIAN_CALENDAR_TARGET_DATE_KEY, this.filters.date || frappe.datetime.now_date());
		frappe.set_route('List', 'Service Appointment', 'Calendar');
	}

	go_to_assignment() {
		set_local_storage_value(TECHNICIAN_ASSIGNMENT_TARGET_DATE_KEY, this.filters.date || frappe.datetime.now_date());
		frappe.set_route('service-assignment-workstation');
	}

	consume_target_date() {
		const value = get_local_storage_value(TECHNICIAN_PAGE_TARGET_DATE_KEY);
		if (!value) return '';
		remove_local_storage_value(TECHNICIAN_PAGE_TARGET_DATE_KEY);
		return value;
	}

	refresh() {
		frappe.call({
			method: 'service_appointment.service_appointment.page.technician_services.technician_services.get_technician_services',
			args: {
				date_from: this.filters.date,
				days: this.filters.days,
			},
			freeze: true,
			freeze_message: __('Loading services...'),
			callback: (r) => {
				this.data = r.message || this.data;
				this.render();
			},
		});
	}

	render() {
		const tech = this.data.technician || {};
		const overdue = this.data.overdue || [];
		const today_rows = this.data.today || [];
		const upcoming = this.data.upcoming || [];

		this.rows_by_name = {};
		[...overdue, ...today_rows, ...upcoming].forEach((row) => {
			this.rows_by_name[row.name] = row;
		});

		const overdue_cls = overdue.length ? 'red' : '';
		this.meta_wrapper.html(`
			<span class="ts-pill">${__('Technician')}: ${this.escape_html(tech.employee_name || tech.employee || '-')}</span>
			<span class="ts-pill ${overdue_cls}">${__('Overdue')}: ${overdue.length}</span>
			<span class="ts-pill">${__('Today')}: ${today_rows.length}</span>
		`);

		const sections = [
			{ label: __('Overdue / Undone'), rows: overdue, cls: 'overdue' },
			{ label: __('Today'), rows: today_rows, cls: '' },
		];

		this.sections_wrapper.html(sections.map((section) => this.render_section(section)).join(''));
	}

	render_section(section) {
		const cards = (section.rows || []).map((row) => this.render_card(row, section.cls)).join('');
		return `
			<div class="ts-section">
				<div class="ts-section-title">${this.escape_html(section.label)}</div>
				${cards ? `<div class="ts-grid">${cards}</div>` : `<div class="ts-empty">${__('No services in this section.')}</div>`}
			</div>
		`;
	}

	render_card(row, section_cls) {
		const status_color = row.status_color || 'gray';
		const collect_cls = row.collect_amount === 'Yes' ? 'yes' : 'no';
		const map_button_cls = row.map_url ? 'btn btn-default btn-xs btn-ts-map' : 'btn btn-default btn-xs btn-ts-map disabled';
		const time_text = this.format_time_label(row.time);
		const date_label = row.date ? frappe.datetime.str_to_user(row.date) : '--';
		const duration_minutes = cint_or_zero(row.duration);
		const service_location = (row.location || row.address_text || '').trim() || '-';
		const assigned_members = (row.assigned_members || []).filter(Boolean);
		const assigned_members_text = assigned_members.length ? assigned_members.join(', ') : '-';

		const actions = [
			`<button type="button" class="${map_button_cls}" data-url="${this.escape_html(row.map_url || '')}">${__('Open in Map')}</button>`,
		];
		if (row.can_start) {
			actions.push(`<button type="button" class="btn btn-primary btn-xs btn-ts-start" data-name="${this.escape_html(row.name)}">${__('Start Service')}</button>`);
		}
		if (row.can_complete) {
			actions.push(`<button type="button" class="btn btn-success btn-xs btn-ts-complete" data-name="${this.escape_html(row.name)}">${__('Complete')}</button>`);
		}
		if (row.can_report_no_start) {
			actions.push(`<button type="button" class="btn btn-warning btn-xs btn-ts-no-start" data-name="${this.escape_html(row.name)}">${__('Could Not Start')}</button>`);
		}

		return `
			<div class="ts-card ${this.escape_html(section_cls || '')}">
				<div class="ts-head">
					<div>
						<div class="ts-title"><a href="/app/service-appointment/${encodeURIComponent(row.name)}" target="_blank">${this.escape_html(row.name)}</a></div>
						<div class="ts-subtitle">${this.escape_html(date_label)} | ${this.escape_html(time_text)} (${duration_minutes}m)</div>
					</div>
					<span class="ts-status ${this.escape_html(status_color)}">${this.escape_html(row.appointment_status || '')}</span>
					</div>
					<div class="ts-row"><strong>${__('Customer')}:</strong> ${this.escape_html(row.customer || '-')}</div>
					<div class="ts-row"><strong>${__('Team')}:</strong> ${this.escape_html(row.team || '-')}</div>
					<div class="ts-row"><strong>${__('Service Location')}:</strong> ${this.escape_html(service_location)}</div>
					<div class="ts-row"><strong>${__('Assigned Members')}:</strong> ${this.escape_html(assigned_members_text)}</div>
					<div class="ts-collect ${collect_cls}">${this.escape_html(row.collect_message || '')}</div>
					<div class="ts-actions">${actions.join('')}</div>
				</div>
			`;
	}

	format_time_label(value) {
		if (!value) return '--';
		const raw = String(value).trim();
		if (typeof moment !== 'undefined') {
			const parsed = moment(raw, ['HH:mm:ss', 'HH:mm'], true);
			if (parsed.isValid()) {
				return parsed.format('h:mm A');
			}
		}
		return raw;
	}

	get_row(appointment) {
		return (this.rows_by_name || {})[appointment] || null;
	}

	start_service(appointment) {
		if (!appointment) return;
		frappe.call({
			method: 'service_appointment.service_appointment.page.technician_services.technician_services.start_service',
			args: {
				appointment,
				started_at: frappe.datetime.now_time(),
			},
			freeze: true,
			freeze_message: __('Starting service...'),
			callback: (r) => {
				if (r.message && r.message.status === 'success') {
					frappe.show_alert({ message: __('Service started'), indicator: 'green' });
					this.refresh();
				}
			},
		});
	}

	open_no_start_dialog(appointment) {
		const d = new frappe.ui.Dialog({
			title: __('Could Not Start Service'),
			fields: [
				{ fieldtype: 'Link', fieldname: 'reason', label: __('Reason'), options: 'Reason of Incompletion', reqd: 1 },
				{ fieldtype: 'Small Text', fieldname: 'remarks', label: __('Remarks'), reqd: 1 },
			],
			primary_action_label: __('Submit'),
			primary_action: (values) => {
				frappe.call({
					method: 'service_appointment.service_appointment.page.technician_services.technician_services.report_could_not_start',
					args: {
						appointment,
						reason: values.reason,
						remarks: values.remarks,
					},
					freeze: true,
					freeze_message: __('Updating service...'),
					callback: (r) => {
						if (r.message && r.message.status === 'success') {
							d.hide();
							frappe.show_alert({ message: __('Service moved to Reschedule'), indicator: 'orange' });
							this.refresh();
						}
					},
				});
			},
		});
		d.show();
	}

	open_complete_wizard(row) {
		const d = new frappe.ui.Dialog({
			title: __('Complete Service: {0}', [row.name]),
			fields: [
				{ fieldtype: 'HTML', fieldname: 'ht_banner' },
				{ fieldtype: 'Select', options: 'Completed\nPartially Completed\nReschedule\nCancelled', fieldname: 'status', label: __('Status') },
				{ fieldtype: 'Link', options: 'Employee', fieldname: 'completed_by', label: __('Completed By') },
				{
					fieldtype: 'Table',
					fieldname: 'other_members',
					label: __('Other Members'),
					in_place_edit: true,
					depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"',
					fields: [
						{ fieldtype: 'Link', fieldname: 'employee', label: __('Employee'), options: 'Employee', in_list_view: 1 },
					],
				},
				{ fieldtype: 'Time', fieldname: 'start_time', label: __('Start Time'), depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
				{ fieldtype: 'Time', fieldname: 'end_time', label: __('End Time'), depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
				{ fieldtype: 'Int', fieldname: 'duration', label: __('Duration'), read_only: 1, depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
				{ fieldtype: 'Select', fieldname: 'collect_amount', label: __('Collect Amount'), options: 'Yes\nNo', read_only: 1, depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
				{ fieldtype: 'Select', fieldname: 'amount_received', label: __('Amount Received'), options: '\nYes\nNo', depends_on: 'eval:doc.status!="Reschedule" && doc.collect_amount=="Yes" && doc.status!="Cancelled"' },
				{ fieldtype: 'Currency', fieldname: 'amount', label: __('Amount'), read_only: 1, depends_on: 'eval:doc.status!="Reschedule" && doc.collect_amount=="Yes" && doc.status!="Cancelled"' },
				{ fieldtype: 'Link', fieldname: 'mode_of_payment', label: __('Mode of Payment'), options: 'Mode of Payment', depends_on: 'eval:doc.status!="Reschedule" && doc.collect_amount=="Yes" && doc.amount_received=="Yes" && doc.status!="Cancelled"' },
				{ fieldtype: 'Currency', fieldname: 'received_amount', label: __('Received Amount'), depends_on: 'eval:doc.status!="Reschedule" && doc.collect_amount=="Yes" && doc.amount_received=="Yes" && doc.status!="Cancelled"' },
				{
					fieldtype: 'Table',
					fieldname: 'used_materials',
					label: __('Used Materials'),
					in_place_edit: true,
					depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"',
					fields: [
						{ fieldtype: 'Link', fieldname: 'item', label: __('Item'), options: 'Item', in_list_view: 1 },
						{ fieldtype: 'Select', fieldname: 'uom', label: __('UOM'), in_list_view: 1 },
						{ fieldtype: 'Float', fieldname: 'qty', label: __('Qty'), in_list_view: 1 },
						{ fieldtype: 'Float', fieldname: 'available_qty', label: __('Available Qty'), in_list_view: 1, read_only: 1 },
					],
				},
				{ fieldtype: 'Link', fieldname: 'reason', label: __('Reason of Incompletion'), options: 'Reason of Incompletion', depends_on: 'eval:doc.status!="Completed"' },
				{ fieldtype: 'Small Text', fieldname: 'remarks', label: __('Remarks') },
				{ fieldtype: 'Data', fieldname: 'customer_name', label: __('Customer Name') },
				{ fieldtype: 'Data', fieldname: 'customer_mobile', label: __('Customer Mobile') },
				{ fieldtype: 'Signature', fieldname: 'customer_signature', label: __('Customer Signature'), depends_on: 'eval:doc.status!="Reschedule" && doc.status!="Cancelled"' },
				{ fieldtype: 'Attach Image', fieldname: 'attachment', label: __('Attachment') },
			],
			primary_action_label: __('Update'),
			primary_action: () => this.submit_complete_dialog(d, row),
		});

		const default_status = (row.appointment_status === 'Scheduled' || row.appointment_status === 'In Progress')
			? 'Completed'
			: (row.appointment_status || 'Completed');
		const completed_by_default = row.completed_by || ((this.data.technician || {}).employee || '');
		const default_start = row.start_time
			|| (row.appointment_status === 'In Progress' ? frappe.datetime.now_time() : (row.time || frappe.datetime.now_time()));
		const default_end = frappe.datetime.now_time();
		const default_duration = cint_or_zero(row.actual_duration) || this.get_duration(default_start, default_end);
		const default_other_members = this.get_default_other_members(row, completed_by_default);

		d.set_values({
			status: default_status,
			completed_by: completed_by_default,
			start_time: default_start,
			end_time: default_end,
			duration: default_duration,
			collect_amount: row.collect_amount || 'No',
			amount_received: row.received_amount ? 'Yes' : '',
			amount: row.total_amount || 0,
			mode_of_payment: row.mode_of_payment || '',
			received_amount: row.received_amount || 0,
			used_materials: row.used_materials || [],
			other_members: default_other_members,
			reason: row.reason_of_incompletion || '',
			remarks: row.remarks || '',
			customer_name: row.customer_name || row.customer || '',
			customer_mobile: row.customer_mobile || row.mobile_no || '',
			customer_signature: row.signature || '',
			attachment: row.attachment || '',
		});

		d._emp_warehouse = '';

		d.fields_dict.start_time.df.onchange = () => {
			d.set_value('duration', this.get_duration(d.get_value('start_time'), d.get_value('end_time')));
		};
		d.fields_dict.end_time.df.onchange = () => {
			d.set_value('duration', this.get_duration(d.get_value('start_time'), d.get_value('end_time')));
		};

		const refresh_depends = () => {
			if (typeof d.refresh_dependency === 'function') {
				d.refresh_dependency();
			}
			this.render_collect_banner(d);
		};
		d.fields_dict.status.df.onchange = refresh_depends;
		d.fields_dict.collect_amount.df.onchange = refresh_depends;
		d.fields_dict.amount_received.df.onchange = refresh_depends;
		d.fields_dict.completed_by.df.onchange = () => {
			const employee = d.get_value('completed_by');
			if (!employee) {
				d._emp_warehouse = '';
				d.set_value('other_members', this.get_default_other_members(row, ''));
				return refresh_depends();
			}

			frappe.call({
				method: 'frappe.client.get',
				args: { doctype: 'Employee', name: employee },
				callback: (r) => {
					d._emp_warehouse = r.message ? r.message.warehouse : '';
				},
			});
			d.set_value('other_members', this.get_default_other_members(row, employee));
			refresh_depends();
		};
		d.fields_dict.completed_by.df.onchange();

		d.fields_dict.used_materials.grid.fields_map.item.get_query = () => ({
			filters: {
				item_group: ['in', ['Technician Products', 'Showroom Product', 'Technician and Showroom Item', 'Pesticides']],
			},
		});

		d.fields_dict.used_materials.grid.fields_map.item.onchange = () => {
			const item_code_field = document.activeElement;
			const item_code = $(item_code_field).val();
			if (!item_code) return;

			frappe.call({
				method: 'frappe.client.get',
				args: { doctype: 'Item', name: item_code },
				callback: (r) => {
					if (!r.message) return;
					const row_idx = parseInt($(item_code_field).parents('.grid-row').data('idx'), 10) - 1;
					if (row_idx < 0 || !d.fields_dict.used_materials.grid.grid_rows[row_idx]) return;

					const uoms = (r.message.uoms || []).map((uom_row) => uom_row.uom).filter(Boolean);
					if (uoms.length) {
						d.fields_dict.used_materials.grid.grid_rows[row_idx].set_field_property('uom', 'options', uoms.join('\n'));
					}

					const consume_uom = r.message.consume_default_uom || r.message.stock_uom || '';
					d.fields_dict.used_materials.grid.grid_rows[row_idx].doc.uom = consume_uom;
					d.fields_dict.used_materials.grid.grid_rows[row_idx].doc.qty = 1;
					d.fields_dict.used_materials.grid.refresh();

					if (!d._emp_warehouse) return;
					frappe.call({
						method: 'erpnext.stock.utils.get_stock_balance',
						args: { item_code, warehouse: d._emp_warehouse },
						callback: (r2) => {
							if (!d.fields_dict.used_materials.grid.grid_rows[row_idx]) return;
							d.fields_dict.used_materials.grid.grid_rows[row_idx].doc.available_qty = r2.message || 0;
							d.fields_dict.used_materials.grid.refresh();
						},
					});
				},
			});
		};

		refresh_depends();
		d.show();
	}

	get_default_other_members(row, completed_by) {
		const seen = {};
		const out = [];
		const add_member = (employee) => {
			const emp = (employee || '').trim();
			if (!emp) return;
			if (completed_by && emp === completed_by) return;
			if (seen[emp]) return;
			seen[emp] = 1;
			out.push({ employee: emp });
		};

		(row.assigned_members || []).forEach((member) => add_member(member));
		(row.other_members || []).forEach((row_member) => add_member((row_member || {}).employee));
		return out;
	}

	render_collect_banner(d) {
		const collect_amount = d.get_value('collect_amount');
		d.fields_dict.ht_banner.$wrapper.html(
			`<div class="form-message ${collect_amount === 'Yes' ? 'red' : 'green'}"><div>${collect_amount === 'Yes' ? __('Collect Amount from customer') : __('Don\'t Collect Amount from customer')}</div></div>`
		);
	}

	submit_complete_dialog(d, row) {
		if (!this.validate_completion_dialog(d)) return;

		const values = d.get_values() || {};
		const payload = {
			appointment_status: values.status,
			reason_of_incompletion: values.reason,
			mode_of_payment: values.mode_of_payment,
			amount_received: values.amount_received,
			received_amount: values.amount_received === 'Yes' ? (values.received_amount || 0) : 0,
			used_materials: values.used_materials || [],
			start_time: values.start_time,
			end_time: values.end_time,
			actual_duration: values.duration,
			customer_name: values.customer_name,
			customer_mobile: values.customer_mobile,
			signature: values.customer_signature,
			remarks: values.remarks,
			attachment: values.attachment,
			completed_by: values.completed_by,
			other_members: values.other_members || [],
		};

		frappe.call({
			method: 'service_appointment.service_appointment.page.technician_services.technician_services.complete_service_mobile',
			args: {
				appointment: row.name,
				payload,
			},
			freeze: true,
			freeze_message: __('Updating service...'),
			callback: (r) => {
				if (r.message && r.message.status === 'success') {
					d.hide();
					frappe.show_alert({ message: __('Service updated successfully'), indicator: 'green' });
					this.refresh();
				}
			},
		});
	}

	validate_completion_dialog(d) {
		const status = d.get_value('status');
		const collect_amount = d.get_value('collect_amount');
		const amount_received = d.get_value('amount_received');
		const received_amount = d.get_value('received_amount');
		const mode_of_payment = d.get_value('mode_of_payment');

		if (status === 'In Progress') {
			frappe.msgprint(__('Please choose a final status to complete this appointment.'));
			return false;
		}
		if (collect_amount === 'Yes' && status === 'Completed' && !amount_received) {
			frappe.msgprint(__('Amount Received field is mandatory.'));
			return false;
		}
		if (collect_amount === 'Yes' && amount_received === 'Yes' && !received_amount && status === 'Completed') {
			frappe.msgprint(__('Received Amount field is mandatory.'));
			return false;
		}
		if (amount_received === 'Yes' && !mode_of_payment) {
			frappe.msgprint(__('Mode of Payment is mandatory.'));
			return false;
		}
		if (status === 'Completed' && !d.get_value('customer_name')) {
			frappe.msgprint(__('Customer Name is mandatory.'));
			return false;
		}
		if (status === 'Completed' && !d.get_value('customer_mobile')) {
			frappe.msgprint(__('Customer Mobile is mandatory.'));
			return false;
		}
		if ((status === 'Reschedule' || status === 'Cancelled') && !d.get_value('reason')) {
			frappe.msgprint(__('Reason of Incompletion is mandatory for this status.'));
			return false;
		}
		if (status !== 'Reschedule' && status !== 'Cancelled') {
			if (!d.get_value('start_time')) {
				frappe.msgprint(__('Start Time is mandatory.'));
				return false;
			}
			if (!d.get_value('end_time')) {
				frappe.msgprint(__('End Time is mandatory.'));
				return false;
			}
		}

		const used_materials = d.get_value('used_materials') || [];
		for (let i = 0; i < used_materials.length; i += 1) {
			const row = used_materials[i] || {};
			if (!row.item) {
				frappe.msgprint(__('Please select item for used materials in row {0}', [i + 1]));
				return false;
			}
			if (!row.qty) {
				frappe.msgprint(__('Please select qty for used materials in row {0}', [i + 1]));
				return false;
			}
			if (!row.uom) {
				frappe.msgprint(__('Please select uom for used materials in row {0}', [i + 1]));
				return false;
			}
		}
		return true;
	}

	get_duration(start_time, end_time) {
		if (!start_time || !end_time) return 0;
		const st = moment(start_time, ['HH:mm:ss', 'HH:mm'], true);
		const en = moment(end_time, ['HH:mm:ss', 'HH:mm'], true);
		if (!st.isValid() || !en.isValid()) return 0;
		let minutes = en.diff(st, 'minutes');
		if (minutes < 0) {
			minutes += (24 * 60);
		}
		return minutes;
	}

	escape_html(value) {
		return frappe.utils.escape_html((value || '').toString());
	}
};

function cint_or_zero(value) {
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : 0;
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
		// ignore
	}
}

function remove_local_storage_value(key) {
	try {
		window.localStorage.removeItem(key);
	} catch (e) {
		// ignore
	}
}
