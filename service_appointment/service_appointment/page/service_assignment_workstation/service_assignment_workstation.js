frappe.provide('service_appointment');

const SA_WORKSTATION_CALENDAR_TARGET_DATE_KEY = 'sa_calendar_target_date';
const SA_WORKSTATION_ASSIGNMENT_TARGET_DATE_KEY = 'sa_assignment_target_date';
const SA_WORKSTATION_TECHNICIAN_TARGET_DATE_KEY = 'sa_technician_target_date';

frappe.pages['service-assignment-workstation'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Service Member Assignment'),
		single_column: true,
	});

	frappe.breadcrumbs.add('Service Appointment');
	new service_appointment.ServiceAssignmentWorkstation(page);
};

service_appointment.ServiceAssignmentWorkstation = class ServiceAssignmentWorkstation {
		constructor(page) {
			this.page = page;
			this.page_body = $(this.page.body);
			this.raw_appointments = [];
			this.appointments = [];
			this.by_name = {};
			this.selected_appointment = null;
			this.member_search = '';
			this.member_board_data = null;
		this.board_state_appointment = null;
		this.board_required_members = 1;
		this.board_selected_members = [];
		this.board_dirty = false;
		this.board_saving = false;
		this.board_autosave_timer = null;
		this.pending_board_save = false;

		this.ensure_styles();
		this.make_filters();
		this.make_body();
		this.setup_navigation_actions();
		this.bind_events();
		this.refresh();
	}

	ensure_styles() {
		if ($('#sa-assignment-workstation-style').length) {
			return;
		}

		$('head').append(`
				<style id="sa-assignment-workstation-style">
						.sa-workstation-root {
							display: flex;
							flex-direction: column;
							gap: 12px;
						}
						.sa-surface {
							border: 1px solid var(--border-color);
							border-radius: 12px;
							background: var(--fg-color);
							padding: 12px;
						}
						.sa-surface-table {
							padding: 0;
							overflow: hidden;
						}
						.sa-surface-table .sa-table-date-nav {
							margin: 0;
							padding: 10px 12px 8px;
							border-bottom: 1px solid var(--border-color);
							background: linear-gradient(180deg, rgba(10, 124, 255, 0.05), transparent);
						}
						.sa-surface-table .assignment-table-wrapper {
							padding: 10px;
						}
						.sa-surface-board {
							padding: 0;
							overflow: hidden;
						}
						.sa-filter-panel {
							display: flex;
							align-items: center;
							gap: 8px;
							flex-wrap: wrap;
							margin: 0;
							overflow: visible;
						}
						.sa-filter-panel .form-control {
							height: 30px;
							font-size: 12px;
						padding: 3px 8px;
						width: auto;
						min-width: 170px;
						flex: 0 0 auto;
					}
					.sa-filter-date-control {
						min-width: 160px;
						flex: 0 0 auto;
					}
					.sa-filter-date-control .frappe-control {
						margin-bottom: 0;
					}
					.sa-filter-date-control .control-input-wrapper {
						display: flex;
					}
					.sa-filter-date-control .control-input-wrapper input {
						height: 30px;
						font-size: 12px;
						padding: 3px 8px;
						min-width: 160px;
					}
					.sa-table-date-nav {
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: 10px;
						flex-wrap: wrap;
						margin: 6px 0 8px;
						padding: 6px 0;
					}
						.sa-table-date-nav-left {
							display: inline-flex;
							align-items: center;
							gap: 10px;
						}
						.sa-date-label {
							font-size: 34px;
							line-height: 1.1;
							font-weight: 700;
							margin: 0;
						}
						.sa-table-date-nav .sa-date-btn {
							width: 28px;
							height: 28px;
						border: 0;
						border-radius: 8px;
						background: var(--gray-100);
					color: var(--text-color);
						font-size: 18px;
						line-height: 1;
						cursor: pointer;
					}
					.sa-table-date-nav .sa-date-btn:hover { background: var(--gray-200); }
					.sa-toolbar-note { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
					.sa-kpi-grid {
						display: grid;
						grid-template-columns: repeat(4, minmax(120px, 1fr));
						gap: 8px;
					}
					.sa-kpi-card {
						border: 1px solid var(--border-color);
						background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), transparent);
						border-radius: 10px;
						padding: 12px;
					}
					.sa-kpi-label { font-size: 11px; color: var(--text-muted); }
					.sa-kpi-value { font-size: 20px; font-weight: 700; line-height: 1.1; margin-top: 2px; }
				.sa-kpi-warning { border-color: #e55353; background: rgba(229, 83, 83, 0.08); }
				.sa-kpi-good { border-color: #2eae6d; background: rgba(46, 174, 109, 0.08); }
				.sa-kpi-info { border-color: #0a7cff; background: rgba(10, 124, 255, 0.08); }

					.sa-table-wrap {
						border: 1px solid var(--border-color);
						border-radius: 8px;
						overflow: auto;
						max-height: 420px;
					}
					.sa-appointments-table { margin-bottom: 0; }
					.sa-appointments-table thead th {
						position: sticky;
						top: 0;
						z-index: 2;
						background: var(--subtle-fg);
						font-weight: 700;
					}
					.sa-appointments-table tbody tr {
						transition: background 0.15s ease;
					}
					.sa-appointments-table tbody tr:hover {
						background: rgba(10, 124, 255, 0.08);
					}
					.sa-table-wrap th,
					.sa-table-wrap td {
						padding: 7px 8px !important;
						font-size: 12px;
						vertical-align: top;
					}
					.sa-selected-row { background: rgba(10, 124, 255, 0.14); }
					.sa-assign-chip { font-size: 11px; font-weight: 700; }
					.sa-address {
						max-width: 260px;
					white-space: nowrap;
					overflow: hidden;
						text-overflow: ellipsis;
					}
					.sa-location { color: #0a7cff; font-weight: 600; }
					.sa-status-badge {
						display: inline-flex;
						align-items: center;
						gap: 6px;
						padding: 3px 8px;
						border-radius: 999px;
						font-size: 11px;
						font-weight: 600;
						border: 1px solid transparent;
					}
					.sa-status-badge-dot {
						width: 7px;
						height: 7px;
						border-radius: 50%;
						background: currentColor;
					}
					.sa-dispatch-actions {
						display: flex;
						flex-wrap: wrap;
						gap: 4px;
						margin-bottom: 6px;
					}
					.sa-dispatch-meta {
						display: flex;
						flex-wrap: wrap;
						gap: 4px;
					}

					.sa-board {
						border: 0;
						border-radius: 0;
						background: transparent;
					}
					.sa-board-head {
						padding: 12px;
						border-bottom: 1px solid var(--border-color);
						display: flex;
						justify-content: space-between;
					gap: 8px;
					align-items: center;
						flex-wrap: wrap;
					}
					.sa-board-list {
						padding: 12px;
						max-height: 480px;
						overflow: auto;
					}
					.sa-board-tools {
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: 8px;
						flex-wrap: wrap;
						margin-bottom: 8px;
					}
					.sa-board-tools .sa-member-search {
						max-width: 300px;
						min-width: 200px;
					}
					.sa-context-legend {
						display: inline-flex;
						align-items: center;
						gap: 8px;
						flex-wrap: wrap;
					}
					.sa-legend-item {
						display: inline-flex;
						align-items: center;
						gap: 5px;
						font-size: 11px;
						color: var(--text-muted);
					}
					.sa-legend-swatch {
						width: 10px;
						height: 10px;
						border-radius: 3px;
						border: 1px solid var(--border-color);
					}
					.sa-legend-selected-team { background: rgba(10, 124, 255, 0.14); border-color: #0a7cff; }
					.sa-legend-other-team { background: rgba(245, 159, 0, 0.14); border-color: #f59f00; }
					.sa-member-grid {
						display: grid;
						grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
						gap: 8px;
					}
					.sa-member-card {
						border: 1px solid var(--border-color);
						border-radius: 8px;
						padding: 8px;
						margin-bottom: 0;
						background: var(--fg-color);
					}
					.sa-member-card.sa-in-team {
						border-color: #70afff;
						background: rgba(10, 124, 255, 0.07);
					}
					.sa-member-card.sa-other-team {
						border-color: #ffcc74;
						background: rgba(245, 159, 0, 0.08);
					}
				.sa-member-card.sa-busy {
					border-color: #e55353;
					background: rgba(229, 83, 83, 0.08);
				}
				.sa-member-card.sa-picked {
					box-shadow: inset 0 0 0 2px #0a7cff;
				}
				.sa-member-head {
					display: flex;
					justify-content: space-between;
					align-items: center;
					gap: 8px;
				}
				.sa-board-actions {
					display: flex;
					align-items: center;
					gap: 6px;
					flex-wrap: wrap;
				}
				.sa-required-control {
					display: inline-flex;
					align-items: center;
					gap: 4px;
					padding: 2px 4px;
					border: 1px solid var(--border-color);
					border-radius: 8px;
					background: var(--fg-color);
				}
				.sa-required-input {
					width: 64px;
					height: 28px;
					text-align: center;
					padding: 3px 6px;
				}
				.sa-board-summary {
					display: flex;
					gap: 8px;
					align-items: center;
					flex-wrap: wrap;
				}
				.sa-summary-pill {
					display: inline-flex;
					align-items: center;
					gap: 4px;
					padding: 2px 8px;
					border-radius: 999px;
					font-size: 11px;
					font-weight: 600;
					background: var(--gray-100);
				}
				.sa-summary-pill.sa-warn {
					background: rgba(245, 159, 0, 0.18);
					color: #825300;
				}
				.sa-summary-pill.sa-ok {
					background: rgba(46, 174, 109, 0.18);
					color: #1f6f46;
				}
				.sa-team-badge {
					display: inline-block;
					font-size: 10px;
					padding: 2px 6px;
					border-radius: 999px;
					margin-right: 4px;
					background: rgba(10, 124, 255, 0.15);
				}
				.sa-other-team .sa-team-badge { background: rgba(245, 159, 0, 0.20); }
				.sa-slot-badge {
					display: inline-block;
					font-size: 10px;
					padding: 2px 5px;
					border-radius: 6px;
					margin: 2px 3px 2px 0;
					background: var(--gray-100);
				}
				.sa-slot-badge.sa-conflict { background: rgba(229, 83, 83, 0.24); color: #971c1c; }

					.sa-selected-list {
						border: 1px solid var(--border-color);
						border-radius: 8px;
						padding: 8px;
						margin-bottom: 8px;
						background: rgba(10, 124, 255, 0.05);
					}
				.sa-selected-item {
					display: flex;
					justify-content: space-between;
					align-items: center;
					gap: 8px;
					padding: 6px;
					border: 1px solid var(--border-color);
					border-radius: 6px;
					margin-bottom: 6px;
					background: var(--fg-color);
				}
				.sa-group-title {
					font-size: 12px;
					font-weight: 700;
					margin: 8px 0 6px;
				}
				.sa-muted { color: var(--text-muted); font-size: 11px; }
				.sa-load-line {
					border: 1px solid var(--border-color);
					border-radius: 6px;
					padding: 6px;
					margin-top: 5px;
					font-size: 11px;
					background: var(--gray-100);
				}
					.sa-load-line .sa-line-top {
						font-weight: 700;
						margin-bottom: 2px;
					}
					.sa-empty-state {
						padding: 20px;
						border: 1px dashed var(--border-color);
						border-radius: 10px;
						color: var(--text-muted);
						text-align: center;
						background: var(--subtle-fg);
					}

						@media (max-width: 1200px) {
							.sa-kpi-grid { grid-template-columns: repeat(3, minmax(120px, 1fr)); }
						}
						@media (max-width: 768px) {
							.sa-kpi-grid { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
							.sa-filter-panel { gap: 6px; }
							.sa-filter-panel .form-control { min-width: 140px; }
							.sa-date-label { font-size: 28px; }
							.sa-board-tools .sa-member-search {
								min-width: 100%;
								max-width: 100%;
							}
							.sa-member-grid {
								grid-template-columns: 1fr;
							}
						}
				</style>
			`);
		}

	make_filters() {
		const initial_date = this.consume_assignment_target_date() || frappe.datetime.now_date();
		this.filters = {
			date: initial_date,
			team: '',
			appointment_status: 'Scheduled',
			assignment_state: 'All',
			member_view: 'selected',
		};
		this.team_options = [];
	}

	setup_navigation_actions() {
		this.page.add_inner_button(__('Auto Assign Visible'), () => this.auto_assign_visible());
		this.page.add_inner_button(__('Auto Dispatch (Selected)'), () => this.auto_dispatch_selected());
		this.page.add_inner_button(__('Apply Best Slot (Selected)'), () => this.apply_best_slot_selected());
		this.page.add_inner_button(__('Calendar'), () => this.go_to_calendar());
		this.page.add_inner_button(__('Technician Services'), () => this.go_to_technician_services());
	}

	go_to_calendar() {
		if (!this.can_leave_with_unsaved_assignment()) return;
		this.flush_board_autosave();
		const target_date = this.filters.date || frappe.datetime.now_date();
		set_local_storage_value(SA_WORKSTATION_CALENDAR_TARGET_DATE_KEY, target_date);
		frappe.set_route('List', 'Service Appointment', 'Calendar');
	}

	go_to_technician_services() {
		if (!this.can_leave_with_unsaved_assignment()) return;
		this.flush_board_autosave();
		const target_date = this.filters.date || frappe.datetime.now_date();
		set_local_storage_value(SA_WORKSTATION_TECHNICIAN_TARGET_DATE_KEY, target_date);
		frappe.set_route('technician-services');
	}

	consume_assignment_target_date() {
		const target = get_local_storage_value(SA_WORKSTATION_ASSIGNMENT_TARGET_DATE_KEY);
		if (!target) return '';
		remove_local_storage_value(SA_WORKSTATION_ASSIGNMENT_TARGET_DATE_KEY);
		return target;
	}

	make_body() {
		this.page.main.find('.sa-workstation-root').remove();

			const root = $(`
					<div class="sa-workstation-root service-assignment-workstation">
						<div class="sa-surface">
							<div class="sa-filter-panel">
								<div class="sa-filter-date-control"></div>
								<select class="form-control input-xs sa-filter-team"></select>
								<select class="form-control input-xs sa-filter-status">
									<option value="Scheduled">${__('Scheduled')}</option>
									<option value="In Progress">${__('In Progress')}</option>
									<option value="Reschedule">${__('Reschedule')}</option>
									<option value="Partially Completed">${__('Partially Completed')}</option>
								<option value="Completed">${__('Completed')}</option>
								<option value="All">${__('All Status')}</option>
							</select>
								<select class="form-control input-xs sa-filter-assignment">
									<option value="All">${__('All Assignment')}</option>
									<option value="Unassigned">${__('Unassigned')}</option>
									<option value="Under Assigned">${__('Under Assigned')}</option>
									<option value="Fully Assigned">${__('Fully Assigned')}</option>
								</select>
								<select class="form-control input-xs sa-filter-member-view">
									<option value="selected">${__('Selected Appointment Availability')}</option>
									<option value="all">${__('All Members Daily Load')}</option>
								</select>
								<button type="button" class="btn btn-default btn-xs sa-filter-clear">${__('Clear')}</button>
								<button type="button" class="btn btn-primary btn-xs sa-filter-apply">${__('Refresh')}</button>
							</div>
						</div>
						<div class="sa-kpi-grid"></div>
						<div class="sa-surface sa-surface-table">
							<div class="sa-table-date-nav">
								<div class="sa-table-date-nav-left">
									<button type="button" class="sa-date-btn sa-table-date-prev" title="${this.escape_html(__('Previous Day'))}">‹</button>
									<h2 class="sa-date-label"></h2>
									<button type="button" class="sa-date-btn sa-table-date-next" title="${this.escape_html(__('Next Day'))}">›</button>
								</div>
								<button type="button" class="btn btn-default btn-xs sa-table-date-today">${__('Today')}</button>
							</div>
							<div class="assignment-table-wrapper"></div>
						</div>
						<div class="sa-surface sa-surface-board">
							<div class="member-board-wrapper"></div>
						</div>
					</div>
				`);

		root.appendTo(this.page.main);
		this.root = root;
		this.date_label_el = root.find('.sa-date-label');
		this.team_select = root.find('.sa-filter-team');
		this.status_select = root.find('.sa-filter-status');
		this.assignment_select = root.find('.sa-filter-assignment');
		this.member_view_select = root.find('.sa-filter-member-view');
		this.kpi_wrapper = root.find('.sa-kpi-grid');
		this.table_wrapper = root.find('.assignment-table-wrapper');
		this.member_board_wrapper = root.find('.member-board-wrapper');
		this.date_control = frappe.ui.form.make_control({
			parent: root.find('.sa-filter-date-control'),
			df: {
				fieldtype: 'Date',
				fieldname: 'filter_date',
				placeholder: __('Date'),
			},
			only_input: true,
			render_input: true,
		});
		this.date_control.refresh();
		this.date_control.$input.on('change', () => {
			const value = this.date_control.get_value();
			if (!value) return;
			if (!this.can_leave_with_unsaved_assignment()) return;
			this.flush_board_autosave();
			this.filters.date = value;
			this.sync_filter_ui();
			this.refresh();
		});

		this.render_team_options();
		this.sync_filter_ui();
		this.load_team_options();
	}

	bind_events() {
		this.page.main.on('click', '.sa-table-date-prev', () => this.shift_day(-1));
		this.page.main.on('click', '.sa-table-date-next', () => this.shift_day(1));
		this.page.main.on('click', '.sa-table-date-today', () => this.set_today());
		this.page.main.on('click', '.sa-filter-apply', () => this.refresh());
		this.page.main.on('click', '.sa-filter-clear', () => this.clear_filters());

		this.page.main.on('change', '.sa-filter-team', (e) => {
			if (!this.can_leave_with_unsaved_assignment()) return;
			this.flush_board_autosave();
			this.filters.team = e.currentTarget.value || '';
			this.refresh();
		});
		this.page.main.on('change', '.sa-filter-status', (e) => {
			if (!this.can_leave_with_unsaved_assignment()) return;
			this.flush_board_autosave();
			this.filters.appointment_status = e.currentTarget.value || 'Scheduled';
			this.refresh();
		});
		this.page.main.on('change', '.sa-filter-assignment', (e) => {
			if (!this.can_leave_with_unsaved_assignment()) return;
			this.flush_board_autosave();
			this.filters.assignment_state = e.currentTarget.value || 'All';
			this.apply_client_filters_and_render();
		});
		this.page.main.on('change', '.sa-filter-member-view', (e) => {
			if (!this.can_leave_with_unsaved_assignment()) {
				this.sync_filter_ui();
				return;
			}
			this.flush_board_autosave();
			this.filters.member_view = e.currentTarget.value || 'selected';
			this.render_member_board();
			this.refresh_member_board();
		});

		this.page_body.on('click', '.appointment-row', (event) => {
			const appointment_name = $(event.currentTarget).data('name');
			if (!appointment_name || this.selected_appointment === appointment_name) {
				return;
			}
			if (!this.can_leave_with_unsaved_assignment()) return;
			this.flush_board_autosave();
			this.selected_appointment = appointment_name;
			this.render_appointments();
			this.refresh_member_board();
		});

		this.page_body.on('click', '.btn-board-toggle-member', (event) => {
			const member = $(event.currentTarget).data('member');
			this.toggle_board_member(member);
		});
		this.page_body.on('click', '.btn-row-auto-dispatch', (event) => {
			const appointment = $(event.currentTarget).data('appointment');
			this.auto_dispatch_row(appointment);
		});
		this.page_body.on('click', '.btn-row-best-slot', (event) => {
			const appointment = $(event.currentTarget).data('appointment');
			this.apply_best_slot_for_appointment(appointment);
		});
		this.page_body.on('click', '.btn-row-lock', (event) => {
			const appointment = $(event.currentTarget).data('appointment');
			const locked = cint_or_zero($(event.currentTarget).data('locked')) ? 0 : 1;
			this.toggle_row_lock(appointment, locked);
		});
		this.page_body.on('click', '.btn-board-remove-member', (event) => {
			const member = $(event.currentTarget).data('member');
			this.remove_board_member(member);
		});
		this.page_body.on('click', '.btn-board-autofill-team', () => this.autofill_board_team_members());
		this.page_body.on('click', '.btn-board-clear-selection', () => this.clear_board_selection());
		this.page_body.on('click', '.btn-board-required-minus', () => this.adjust_board_required(-1));
			this.page_body.on('click', '.btn-board-required-plus', () => this.adjust_board_required(1));
			this.page_body.on('change', '.sa-required-input', (event) => {
				const value = cint_or_one($(event.currentTarget).val());
				this.set_board_required_members(value);
			});
			this.page_body.on('input', '.sa-member-search', (event) => {
				this.member_search = (event.currentTarget.value || '').trim().toLowerCase();
				this.render_member_board();
			});
		}

	shift_day(days) {
		if (!this.can_leave_with_unsaved_assignment()) return;
		this.flush_board_autosave();
		const current = this.filters.date || frappe.datetime.now_date();
		this.filters.date = frappe.datetime.add_days(current, days);
		this.sync_filter_ui();
		this.refresh();
	}

	set_today() {
		if (!this.can_leave_with_unsaved_assignment()) return;
		this.flush_board_autosave();
		this.filters.date = frappe.datetime.now_date();
		this.sync_filter_ui();
		this.refresh();
	}

	clear_filters() {
		if (!this.can_leave_with_unsaved_assignment()) return;
		this.flush_board_autosave();
		this.filters.team = '';
		this.filters.appointment_status = 'Scheduled';
		this.filters.assignment_state = 'All';
		this.filters.member_view = 'selected';
		this.sync_filter_ui();
		this.refresh();
	}

	sync_filter_ui() {
		if (!this.root) return;
		this.date_label_el.text(this.format_date_label(this.filters.date));
		if (this.date_control) {
			this.date_control.set_value(this.filters.date || '');
		}
		this.team_select.val(this.filters.team || '');
		this.status_select.val(this.filters.appointment_status || 'Scheduled');
		this.assignment_select.val(this.filters.assignment_state || 'All');
		if (this.member_view_select) {
			this.member_view_select.val(this.filters.member_view || 'selected');
		}
	}

	render_team_options() {
		if (!this.team_select) return;
		const options = [`<option value="">${__('All Teams')}</option>`].concat(
			this.team_options.map((team_name) => `<option value="${this.escape_html(team_name)}">${this.escape_html(team_name)}</option>`)
		);
		this.team_select.html(options.join(''));
	}

	load_team_options() {
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Team',
				fields: ['name'],
				order_by: 'name asc',
				limit_page_length: 500,
			},
			callback: (r) => {
				this.team_options = (r.message || []).map((row) => row.name).filter(Boolean);
				this.render_team_options();
				this.sync_filter_ui();
			},
		});
	}

	format_date_label(date_str) {
		if (!date_str) return '';
		if (typeof moment !== 'undefined') {
			return moment(date_str, 'YYYY-MM-DD').format('MMMM D, YYYY');
		}
		return date_str;
	}

	get_filters() {
		return {
			date: this.filters.date,
			team: this.filters.team,
			appointment_status: this.filters.appointment_status || 'Scheduled',
		};
	}

	refresh() {
		const filters = this.get_filters();
		if (!filters.date) {
			return;
		}

		frappe.call({
			method: 'service_appointment.service_appointment.page.service_assignment_workstation.service_assignment_workstation.get_daily_appointments',
			args: filters,
			freeze: true,
			freeze_message: __('Loading appointments...'),
			callback: (r) => {
				this.raw_appointments = r.message || [];
				this.apply_client_filters_and_render();
			},
		});
	}

	apply_client_filters_and_render() {
		const assignment_filter = this.filters.assignment_state || 'All';

		this.appointments = (this.raw_appointments || []).filter((row) => {
			const required = cint_or_one(row.required_members);
			const assigned = row.assigned_count || 0;

			if (assignment_filter === 'Unassigned' && assigned !== 0) return false;
			if (assignment_filter === 'Under Assigned' && !(assigned > 0 && assigned < required)) return false;
			if (assignment_filter === 'Fully Assigned' && !(assigned >= required)) return false;

			return true;
		});

		this.by_name = {};
		this.appointments.forEach((row) => {
			this.by_name[row.name] = row;
		});

		if (!this.by_name[this.selected_appointment]) {
			this.selected_appointment = this.appointments.length ? this.appointments[0].name : null;
		}

		this.render_appointments();
		this.refresh_member_board();
	}

	render_kpis(stats) {
		const cards = [
			{ label: __('Total'), value: stats.total, cls: '' },
			{ label: __('Fully Assigned'), value: stats.fully_assigned, cls: 'sa-kpi-good' },
			{ label: __('Under Assigned'), value: stats.under_assigned, cls: stats.under_assigned ? 'sa-kpi-warning' : '' },
			{ label: __('Unassigned'), value: stats.unassigned, cls: stats.unassigned ? 'sa-kpi-warning' : '' },
		];

		this.kpi_wrapper.html(cards.map((c) => `
			<div class="sa-kpi-card ${c.cls}">
				<div class="sa-kpi-label">${c.label}</div>
				<div class="sa-kpi-value">${c.value}</div>
			</div>
		`).join(''));
	}

	render_appointments() {
		if (!this.appointments.length) {
			this.render_kpis({ total: 0, fully_assigned: 0, under_assigned: 0, unassigned: 0 });
				this.table_wrapper.html(`
					<div class="sa-empty-state">
						${__('No appointments were found.')}
					</div>
				`);
				return;
		}

		const stats = {
			total: this.appointments.length,
			fully_assigned: this.appointments.filter((r) => (r.assigned_count || 0) >= cint_or_one(r.required_members)).length,
			under_assigned: this.appointments.filter((r) => (r.assigned_count || 0) > 0 && (r.assigned_count || 0) < cint_or_one(r.required_members)).length,
			unassigned: this.appointments.filter((r) => !(r.assigned_count || 0)).length,
		};
		this.render_kpis(stats);

			let html = `
				<div class="sa-table-wrap">
					<table class="table table-bordered sa-appointments-table">
						<thead>
							<tr>
								<th>${__('Appointment')}</th>
							<th>${__('Time')}</th>
							<th>${__('Customer')}</th>
							<th>${__('Team')}</th>
							<th>${__('Address / Location')}</th>
							<th>${__('Assigned')}</th>
							<th>${__('Status')}</th>
							<th>${__('Dispatch')}</th>
						</tr>
					</thead>
					<tbody>
		`;

		this.appointments.forEach((row) => {
			const required = cint_or_one(row.required_members);
			const assigned_count = row.assigned_count || 0;
			const members_text = (row.assigned_members || []).join(', ');
			const row_cls = this.selected_appointment === row.name ? 'sa-selected-row' : '';
			const lock_label = cint_or_zero(row.assignment_locked) ? __('Unlock') : __('Lock');
			const dispatch_badges = this.render_dispatch_badges(row);

			let state_color = '#2eae6d';
			if (assigned_count === 0) state_color = '#e55353';
			else if (assigned_count < required) state_color = '#f59f00';

			const addr = this.extract_address(row.address_display || row.customer_address || '');
			const location = row.location ? `<div class="sa-location">${this.escape_html(row.location)}</div>` : '';
			const address_line = addr ? `<div class="sa-address" title="${this.escape_html(addr)}">${this.escape_html(addr)}</div>` : '<div class="sa-muted">-</div>';

			html += `
				<tr class="appointment-row ${row_cls}" data-name="${this.escape_html(row.name)}" style="cursor:pointer;">
					<td><a href="/app/service-appointment/${encodeURIComponent(row.name)}" target="_blank">${this.escape_html(row.name)}</a></td>
					<td>${this.escape_html(row.time || '')}<br><span class="sa-muted">${cint_or_zero(row.duration)}m</span></td>
					<td>${this.escape_html(row.customer || '')}</td>
					<td>${this.escape_html(row.team || '')}</td>
					<td>${location}${address_line}</td>
						<td>
							<div class="sa-assign-chip" style="color:${state_color};">${assigned_count}/${required}</div>
							<div class="sa-muted" title="${this.escape_html(members_text)}">${this.escape_html(members_text || '-')}</div>
						</td>
							<td>${this.render_status_badge(row.appointment_status || '', state_color)}</td>
								<td>
									<div class="sa-dispatch-actions">
										<button type="button" class="btn btn-xs btn-default btn-row-best-slot" data-appointment="${this.escape_html(row.name)}">${__('Best Slot')}</button>
										<button type="button" class="btn btn-xs btn-primary btn-row-auto-dispatch" data-appointment="${this.escape_html(row.name)}">${__('Auto Dispatch')}</button>
										<button type="button" class="btn btn-xs btn-default btn-row-lock" data-appointment="${this.escape_html(row.name)}" data-locked="${cint_or_zero(row.assignment_locked)}">${lock_label}</button>
									</div>
									<div class="sa-dispatch-meta">${dispatch_badges}</div>
							</td>
					</tr>
				`;
			});

		html += '</tbody></table></div>';
		this.table_wrapper.html(html);
	}

	refresh_member_board() {
		const filters = this.get_filters();
		if (!filters.date) {
			this.member_board_wrapper.empty();
			return;
		}

		const selected_row = this.by_name[this.selected_appointment] || null;
		const is_all_view = this.is_all_members_view();
		const context_team = is_all_view ? (filters.team || '') : ((selected_row && selected_row.team) || filters.team || '');
		const context_appointment = is_all_view ? '' : this.selected_appointment;

		frappe.call({
			method: 'service_appointment.service_appointment.page.service_assignment_workstation.service_assignment_workstation.get_member_daily_load',
			args: {
				date: filters.date,
				appointment: context_appointment,
				team: context_team,
			},
			freeze: false,
			callback: (r) => {
				this.member_board_data = r.message || { members: [] };
				this.render_member_board();
			},
		});
	}

	is_all_members_view() {
		return (this.filters.member_view || 'selected') === 'all';
	}

		render_member_board() {
			const data = this.member_board_data || { members: [] };
			const members = data.members || [];
			const selected_row = this.by_name[this.selected_appointment] || null;
			const all_view = this.is_all_members_view();

		if (all_view) {
			this.render_all_members_board(data, members);
			return;
		}

		if (!this.appointments.length) {
			this.reset_board_state();
			return;
		}

		if (!selected_row) {
			this.reset_board_state();
			this.member_board_wrapper.html(`
				<div class="sa-board"><div class="sa-board-head text-muted">${__('Select an appointment row to compare member availability.')}</div></div>
			`);
			return;
		}

			this.ensure_board_state_for_row(selected_row);

			const filtered_members = this.filter_members_by_query(members);
			const available_count = members.filter((m) => m.slot_status === 'available').length;
			const busy_count = members.filter((m) => m.slot_status === 'busy').length;
			const required = cint_or_one(this.board_required_members);
			const assigned = this.board_selected_members.length;
			const missing = Math.max(required - assigned, 0);
		const member_map = {};
		members.forEach((m) => {
			member_map[m.employee] = m;
		});

		const selected_rows = this.board_selected_members.map((member_id, idx) => {
			const member = member_map[member_id] || { employee: member_id, employee_name: member_id, slot_status: 'unknown' };
			return `
				<div class="sa-selected-item">
					<div>
						<div style="font-weight:700; font-size:12px;">${idx + 1}. ${this.escape_html(member.employee_name || member.employee)}</div>
						<div class="sa-muted">${this.escape_html(member.employee || member_id)}</div>
					</div>
					<button type="button" class="btn btn-xs btn-danger btn-board-remove-member" data-member="${this.escape_html(member_id)}">${__('Remove')}</button>
				</div>
			`;
		}).join('');

		const coverage_pill = missing
			? `<span class="sa-summary-pill sa-warn">${__('Need {0} more', [missing])}</span>`
			: `<span class="sa-summary-pill sa-ok">${__('Fully Covered')}</span>`;

		let html = `
			<div class="sa-board">
				<div class="sa-board-head">
					<div>
						<div style="font-weight:700;">${__('Availability for {0}', [this.escape_html(selected_row.name)])}</div>
						<div class="sa-muted">${__('Slot: {0} ({1} mins) | Available: {2} | Busy: {3}', [
			this.escape_html(selected_row.time || '--'),
			cint_or_zero(selected_row.duration),
			available_count,
			busy_count
		])}</div>
						<div class="sa-board-summary" style="margin-top:6px;">
							<span class="sa-summary-pill">${__('Assigned {0}/{1}', [assigned, required])}</span>
							${coverage_pill}
							${this.board_saving
				? `<span class="indicator blue">${__('Saving...')}</span>`
				: this.board_dirty
					? `<span class="indicator orange">${__('Unsaved Changes')}</span>`
					: `<span class="indicator green">${__('Saved')}</span>`}
						</div>
					</div>
						<div class="sa-board-actions">
							<div class="sa-required-control">
								<button type="button" class="btn btn-xs btn-default btn-board-required-minus">-</button>
								<input type="number" min="1" step="1" class="form-control input-xs sa-required-input" value="${required}">
								<button type="button" class="btn btn-xs btn-default btn-board-required-plus">+</button>
							</div>
							<button type="button" class="btn btn-xs btn-default btn-board-autofill-team">${__('Auto Fill Team')}</button>
							<button type="button" class="btn btn-xs btn-default btn-board-clear-selection">${__('Clear')}</button>
						</div>
					</div>
					<div class="sa-board-list">
						<div class="sa-board-tools">
							<input type="text" class="form-control input-xs sa-member-search" placeholder="${this.escape_html(__('Search member, code, team'))}" value="${this.escape_html(this.member_search || '')}">
							<div class="sa-muted">${__('Showing {0} of {1}', [filtered_members.length, members.length])}</div>
							<div class="sa-context-legend">
								<span class="sa-legend-item"><span class="sa-legend-swatch sa-legend-selected-team"></span>${__('Selected Team')}</span>
								<span class="sa-legend-item"><span class="sa-legend-swatch sa-legend-other-team"></span>${__('Other Teams')}</span>
							</div>
						</div>
						<div class="sa-selected-list">
							<div class="sa-group-title">${__('Selected Members')} (${assigned})</div>
							${selected_rows || `<div class="sa-muted">${__('No members selected yet')}</div>`}
						</div>
			`;

			if (!filtered_members.length) {
				html += `<div class="text-muted">${__('No members found from Team Member master.')}</div>`;
			} else {
				html += `<div class="sa-member-grid">`;
				filtered_members.forEach((member) => {
					const is_selected = this.board_selected_members.includes(member.employee);
					const cls = this.get_member_card_class(member, is_selected);
					const teams = (member.teams || []).map((t) => `<span class="sa-team-badge">${this.escape_html(t.team_name || t.team)}</span>`).join('');
				const slots = (member.assigned_services || []).map((svc) => {
					const bcls = svc.conflict ? 'sa-slot-badge sa-conflict' : 'sa-slot-badge';
					return `<span class="${bcls}" title="${this.escape_html(svc.appointment || '')}">${this.escape_html(svc.slot_label || '--')} ${this.escape_html(svc.appointment || '')}</span>`;
				}).join('');

				html += `
					<div class="sa-member-card ${cls}">
						<div class="sa-member-head">
							<div>
								<div style="font-weight:700; font-size:12px;">${this.escape_html(member.employee_name || member.employee)}</div>
								<div class="sa-muted">${this.escape_html(member.employee)}</div>
							</div>
							<div style="display:flex; gap:6px; align-items:center;">
								${this.get_status_badge(member.slot_status)}
								<button type="button" class="btn btn-xs ${is_selected ? 'btn-danger' : 'btn-default'} btn-board-toggle-member" data-member="${this.escape_html(member.employee)}">${is_selected ? __('Remove') : __('Add')}</button>
							</div>
						</div>
						<div style="margin-top:5px;">${teams || `<span class="sa-muted">${__('No team')}</span>`}</div>
						<div style="margin-top:5px;">${slots || `<span class="sa-muted">${__('No assigned services today')}</span>`}</div>
						</div>
					`;
				});
				html += '</div>';
			}

			html += '</div></div>';
			this.member_board_wrapper.html(html);
		}

		render_all_members_board(data, members) {
			this.reset_board_state();
			const filtered_members = this.filter_members_by_query(members);
			const selected_team = data.selected_team || this.filters.team || '';
			const total = members.length;
			const no_service = members.filter((m) => !cint_or_zero(m.assigned_service_count)).length;

		let html = `
			<div class="sa-board">
				<div class="sa-board-head">
					<div>
						<div style="font-weight:700;">${__('All Members Daily Load')}</div>
						<div class="sa-muted">${__('Date: {0} | Members: {1} | No Services: {2}', [
			this.escape_html(this.format_date_label(this.filters.date || frappe.datetime.now_date())),
			total,
			no_service,
		])}</div>
						</div>
						<div class="sa-muted">${selected_team ? __('Selected Team Highlight: {0}', [this.escape_html(selected_team)]) : __('All Teams')}</div>
					</div>
					<div class="sa-board-list">
						<div class="sa-board-tools">
							<input type="text" class="form-control input-xs sa-member-search" placeholder="${this.escape_html(__('Search member, code, team'))}" value="${this.escape_html(this.member_search || '')}">
							<div class="sa-muted">${__('Showing {0} of {1}', [filtered_members.length, total])}</div>
							<div class="sa-context-legend">
								<span class="sa-legend-item"><span class="sa-legend-swatch sa-legend-selected-team"></span>${__('Selected Team')}</span>
								<span class="sa-legend-item"><span class="sa-legend-swatch sa-legend-other-team"></span>${__('Other Teams')}</span>
							</div>
						</div>
			`;

			if (!filtered_members.length) {
				html += `<div class="text-muted">${__('No members found from Team Member master.')}</div>`;
			} else {
				html += `<div class="sa-member-grid">`;
				filtered_members.forEach((member) => {
					const teams = (member.teams || []).map((t) => `<span class="sa-team-badge">${this.escape_html(t.team_name || t.team)}</span>`).join('');
					const services = member.assigned_services || [];
					const service_rows = services.map((svc) => {
					const location_text = (svc.location || svc.address_text || '').trim();
					return `
						<div class="sa-load-line">
							<div class="sa-line-top">${this.escape_html(svc.slot_label || '--')} | ${this.escape_html(svc.appointment || '')}</div>
							<div>${this.escape_html(svc.customer || '-')} · ${this.escape_html(svc.team || '-')}</div>
							<div class="sa-muted">${this.escape_html(location_text || '-')}</div>
						</div>
					`;
				}).join('');

				html += `
					<div class="sa-member-card ${member.in_selected_team ? 'sa-in-team' : 'sa-other-team'}">
						<div class="sa-member-head">
							<div>
								<div style="font-weight:700; font-size:12px;">${this.escape_html(member.employee_name || member.employee)}</div>
								<div class="sa-muted">${this.escape_html(member.employee)}</div>
							</div>
							<div class="sa-summary-pill">${__('Services: {0}', [cint_or_zero(member.assigned_service_count)])}</div>
						</div>
						<div style="margin-top:5px;">${teams || `<span class="sa-muted">${__('No team')}</span>`}</div>
						<div style="margin-top:6px;">${service_rows || `<span class="sa-muted">${__('No assigned services today')}</span>`}</div>
						</div>
					`;
				});
				html += '</div>';
			}

			html += '</div></div>';
			this.member_board_wrapper.html(html);
		}

		filter_members_by_query(members) {
			const query = (this.member_search || '').trim().toLowerCase();
			if (!query) return members || [];

			return (members || []).filter((member) => {
				const team_text = (member.teams || [])
					.map((team) => `${team.team_name || ''} ${team.team || ''}`)
					.join(' ');
				const search_blob = [
					member.employee || '',
					member.employee_name || '',
					team_text,
				].join(' ').toLowerCase();
				return search_blob.includes(query);
			});
		}

	reset_board_state() {
		if (this.board_autosave_timer) {
			clearTimeout(this.board_autosave_timer);
			this.board_autosave_timer = null;
		}
		this.board_state_appointment = null;
		this.board_required_members = 1;
		this.board_selected_members = [];
		this.board_dirty = false;
		this.board_saving = false;
		this.pending_board_save = false;
	}

	ensure_board_state_for_row(row) {
		if (this.board_state_appointment === row.name) {
			if (!this.board_dirty) {
				this.board_required_members = cint_or_one(row.required_members);
				this.board_selected_members = [];
				(row.assigned_members || []).forEach((member) => {
					if (member && !this.board_selected_members.includes(member)) {
						this.board_selected_members.push(member);
					}
				});
			}
			return;
		}

		this.board_state_appointment = row.name;
		this.board_required_members = cint_or_one(row.required_members);
		this.board_selected_members = [];
		(row.assigned_members || []).forEach((member) => {
			if (member && !this.board_selected_members.includes(member)) {
				this.board_selected_members.push(member);
			}
		});
		this.board_dirty = false;
	}

	mark_board_dirty_and_schedule() {
		this.board_dirty = true;
		this.queue_board_autosave();
		this.render_member_board();
	}

	queue_board_autosave() {
		if (!this.board_state_appointment || !this.board_dirty) {
			return;
		}
		if (this.board_autosave_timer) {
			clearTimeout(this.board_autosave_timer);
		}
		this.board_autosave_timer = setTimeout(() => {
			this.board_autosave_timer = null;
			this.save_board_assignment({ auto: true, silent: true });
		}, 700);
	}

	flush_board_autosave() {
		if (this.board_autosave_timer) {
			clearTimeout(this.board_autosave_timer);
			this.board_autosave_timer = null;
		}
		if (this.board_dirty && !this.board_saving) {
			this.save_board_assignment({ auto: true, silent: true, force: true });
		}
	}

	can_leave_with_unsaved_assignment() {
		if (!this.board_dirty) return true;
		const payload = this.get_board_assignment_payload();
		if (!payload) return true;
		if (payload.assigned_members.length >= payload.required_members) {
			return true;
		}

		frappe.msgprint(__('Complete assignment first: assigned members ({0}) are less than required members ({1}).', [
			payload.assigned_members.length,
			payload.required_members,
		]));
		return false;
	}

	set_board_required_members(value) {
		if (!this.board_state_appointment) return;
		const next_value = Math.max(1, cint_or_one(value));
		if (next_value === this.board_required_members) {
			return;
		}
		this.board_required_members = next_value;
		this.mark_board_dirty_and_schedule();
	}

	adjust_board_required(delta) {
		if (!this.board_state_appointment) return;
		this.set_board_required_members(this.board_required_members + delta);
	}

	toggle_board_member(member_id) {
		if (!this.board_state_appointment || !member_id) return;
		const idx = this.board_selected_members.indexOf(member_id);
		if (idx === -1) {
			this.board_selected_members.push(member_id);
		} else {
			this.board_selected_members.splice(idx, 1);
		}
		this.mark_board_dirty_and_schedule();
	}

	remove_board_member(member_id) {
		if (!this.board_state_appointment || !member_id) return;
		const idx = this.board_selected_members.indexOf(member_id);
		if (idx === -1) return;
		this.board_selected_members.splice(idx, 1);
		this.mark_board_dirty_and_schedule();
	}

	clear_board_selection() {
		if (!this.board_state_appointment) return;
		if (!this.board_selected_members.length) return;
		this.board_selected_members = [];
		this.mark_board_dirty_and_schedule();
	}

	autofill_board_team_members() {
		if (!this.board_state_appointment) return;
		const members = (this.member_board_data && this.member_board_data.members) || [];
		const required = cint_or_one(this.board_required_members);
		const ordered = members
			.filter((m) => m.in_selected_team)
			.sort((a, b) => {
				const ap = this.get_slot_status_priority(a.slot_status);
				const bp = this.get_slot_status_priority(b.slot_status);
				if (ap !== bp) return ap - bp;
				return cint_or_zero(a.assigned_service_count) - cint_or_zero(b.assigned_service_count);
			});

		const selected = [];
		for (const member of ordered) {
			if (!member.employee) continue;
			if (selected.length >= required) break;
			selected.push(member.employee);
		}
		const current = this.board_selected_members.join('|');
		const next = selected.join('|');
		if (current === next) {
			return;
		}
		this.board_selected_members = selected;
		this.mark_board_dirty_and_schedule();
	}

	save_board_assignment(options = {}) {
		const opts = Object.assign({ auto: false, silent: false, force: false }, options);
		const payload = this.get_board_assignment_payload();
		if (!payload) return;
		if (!opts.force && !this.board_dirty) return;

		if (payload.assigned_members.length < payload.required_members) {
			if (!opts.silent) {
				frappe.msgprint(__('Assigned members ({0}) cannot be less than Required Members ({1}).', [payload.assigned_members.length, payload.required_members]));
			}
			return;
		}

		if (this.board_saving) {
			this.pending_board_save = true;
			return;
		}

		const request_signature = this.get_assignment_signature(payload.required_members, payload.assigned_members);
		this.board_saving = true;
		if (this.board_state_appointment === payload.appointment) {
			this.render_member_board();
		}

		frappe.call({
			method: 'service_appointment.service_appointment.page.service_assignment_workstation.service_assignment_workstation.assign_appointment_members',
			args: {
				appointment: payload.appointment,
				required_members: payload.required_members,
				assigned_members: payload.assigned_members,
				expected_modified: payload.expected_modified,
			},
			freeze: !opts.auto,
			freeze_message: __('Saving assignment...'),
			callback: (res) => {
				const success = !!(res && !res.exc && res.message && res.message.status === 'success');
				this.board_saving = false;

				if (success) {
					this.update_appointment_assignment_cache(
						payload.appointment,
						payload.required_members,
						payload.assigned_members,
						res.message.modified
					);
					if (this.board_state_appointment === payload.appointment) {
						const live_signature = this.get_assignment_signature(this.board_required_members, this.board_selected_members);
						if (live_signature === request_signature) {
							this.board_dirty = false;
						}
					}
					if (!opts.silent) {
						frappe.show_alert({ message: __('Assignment updated for {0}', [payload.appointment]), indicator: 'green' });
					}
					this.apply_client_filters_and_render();
				} else {
					const message = this.get_server_error_message(res) || __('Could not save assignment. Please try again.');
					if (!opts.silent) {
						frappe.msgprint(message);
					} else {
						frappe.show_alert({ message, indicator: 'red' }, 7);
					}
				}

				if (this.pending_board_save) {
					this.pending_board_save = false;
					this.queue_board_autosave();
					return;
				}
				if (this.board_dirty) {
					this.queue_board_autosave();
					return;
				}
				if (!success && this.board_state_appointment === payload.appointment) {
					this.render_member_board();
				}
			},
			error: () => {
				this.board_saving = false;
				const message = __('Could not save assignment. Please try again.');
				if (!opts.silent) {
					frappe.msgprint(message);
				} else {
					frappe.show_alert({ message, indicator: 'red' }, 7);
				}
				if (this.board_state_appointment === payload.appointment) {
					this.render_member_board();
				}
			},
		});
	}

	get_board_assignment_payload() {
		const appointment = this.board_state_appointment || this.selected_appointment;
		if (!appointment) return null;

		const row = this.by_name[appointment] || (this.raw_appointments || []).find((r) => r.name === appointment);
		if (!row) return null;

		return {
			appointment: row.name,
			required_members: cint_or_one(this.board_required_members),
			assigned_members: [...this.board_selected_members],
			expected_modified: row.modified || null,
		};
	}

	get_assignment_signature(required_members, members) {
		return `${cint_or_one(required_members)}::${(members || []).join('|')}`;
	}

	get_server_error_message(res) {
		if (!res) return '';
		if (res._server_messages) {
			try {
				const parsed = JSON.parse(res._server_messages);
				if (Array.isArray(parsed) && parsed.length) {
					const first = parsed[0];
					if (typeof first === 'string') {
						const message_obj = JSON.parse(first);
						return message_obj.message || first;
					}
				}
			} catch (e) {
				// ignore parse error and fall back
			}
		}
		if (typeof res.message === 'string') {
			return res.message;
		}
		return '';
	}

	update_appointment_assignment_cache(appointment, required_members, members, modified = null) {
		const update_row = (row) => {
			if (!row || row.name !== appointment) return false;
			row.required_members = cint_or_one(required_members);
			row.assigned_members = [...(members || [])];
			row.assigned_count = (members || []).length;
			if (modified) {
				row.modified = modified;
			}
			return true;
		};

		let done = false;
		for (const row of (this.raw_appointments || [])) {
			if (update_row(row)) {
				done = true;
				break;
			}
		}
		if (!done) {
			update_row(this.by_name[appointment]);
		}
	}

	get_slot_status_priority(slot_status) {
		if (slot_status === 'available') return 0;
		if (slot_status === 'unknown') return 1;
		return 2;
	}

	get_member_card_class(member, is_selected = false) {
		const cls = [];
		cls.push(member.in_selected_team ? 'sa-in-team' : 'sa-other-team');
		if (member.slot_status === 'busy') cls.push('sa-busy');
		if (is_selected) cls.push('sa-picked');
		return cls.join(' ');
	}

		get_status_badge(slot_status) {
			if (slot_status === 'busy') return `<span class="indicator red">${__('Busy')}</span>`;
			if (slot_status === 'available') return `<span class="indicator green">${__('Available')}</span>`;
			return `<span class="indicator orange">${__('Unknown')}</span>`;
		}

		render_status_badge(status, color) {
			const safe_status = this.escape_html(status || __('Unknown'));
			const safe_color = this.escape_html(color || '#5e64ff');
			return `<span class="sa-status-badge" style="color:${safe_color}; border-color:${safe_color}33; background:${safe_color}12;"><span class="sa-status-badge-dot"></span>${safe_status}</span>`;
		}

	render_dispatch_badges(row) {
		const badges = [];
		const note = (row.assignment_note || '').toString();
		const coverageMatch = note.match(/Coverage:\s*([A-Za-z ]+)/i);
		const fallbackMatch = note.match(/Fallback:\s*(Yes|No)/i);
		if (cint_or_zero(row.assignment_locked)) {
			badges.push(`<span class="sa-summary-pill sa-warn">${__('Locked')}</span>`);
		}
		if ((row.assignment_state || '') === 'Under Assigned') {
			badges.push(`<span class="sa-summary-pill sa-warn">${__('Under Assigned')}</span>`);
		}
		if (coverageMatch && coverageMatch[1]) {
			badges.push(`<span class="sa-summary-pill">${__('Coverage')}: ${this.escape_html(coverageMatch[1].trim())}</span>`);
		}
		if (fallbackMatch && (fallbackMatch[1] || '').toLowerCase() === 'yes') {
			badges.push(`<span class="sa-summary-pill sa-warn">${__('Fallback')}</span>`);
		}
			return badges.length ? badges.join('') : `<span class="sa-muted">-</span>`;
		}

	auto_assign_visible(force_recalculate = 0) {
		if (!this.appointments.length) {
			frappe.msgprint(__('No visible appointments to auto-assign.'));
			return;
		}
		if (!this.can_leave_with_unsaved_assignment()) return;
		this.flush_board_autosave();

		frappe.call({
			method: 'service_appointment.service_appointment.page.service_assignment_workstation.service_assignment_workstation.auto_assign_day',
			args: {
				date: this.filters.date,
				team: this.filters.team || '',
				assignment_state: 'All',
				force_recalculate: force_recalculate ? 1 : 0,
			},
			freeze: true,
			freeze_message: __('Applying auto assignment...'),
			callback: (r) => {
				const msg = r.message || {};
				const summary = __('Applied: {0}, Skipped Locked: {1}, Under Assigned: {2}, Errors: {3}', [
					cint_or_zero(msg.applied),
					cint_or_zero(msg.skipped_locked),
					cint_or_zero(msg.under_assigned),
					cint_or_zero(msg.errors),
				]);
				frappe.show_alert({ message: summary, indicator: 'green' }, 7);
				this.refresh();
			},
		});
	}

	auto_dispatch_selected() {
		if (!this.selected_appointment) {
			frappe.msgprint(__('Select an appointment row first.'));
			return;
		}
		this.auto_dispatch_row(this.selected_appointment);
	}

	auto_dispatch_row(appointment, force_recalculate = 0) {
		if (!appointment) return;
		if (!this.can_leave_with_unsaved_assignment()) return;
		this.flush_board_autosave();

		frappe.call({
			method: 'service_appointment.service_appointment.page.service_assignment_workstation.service_assignment_workstation.auto_dispatch_apply',
			args: {
				appointment,
				force_recalculate: force_recalculate ? 1 : 0,
				source: 'workstation_row',
			},
			freeze: true,
			freeze_message: __('Auto dispatching appointment...'),
			callback: (r) => {
				const out = r.message || {};
				if (out.status === 'skipped') {
					frappe.show_alert({ message: out.message || __('Assignment skipped (locked).'), indicator: 'orange' }, 7);
					return;
				}
				if (out.status !== 'success') {
					frappe.msgprint(out.message || __('Could not auto dispatch this appointment.'));
					return;
				}

				const local = this.by_name[appointment] || (this.raw_appointments || []).find((row) => row.name === appointment);
				if (local) {
					local.team = out.team || local.team;
					local.assignment_note = out.assignment_note || local.assignment_note;
					local.assignment_state = out.assignment_state || local.assignment_state;
					local.assignment_locked = cint_or_zero(out.assignment_locked);
					if (out.expected_modified) {
						local.modified = out.expected_modified;
					}
					if (Array.isArray(out.selected_members)) {
						local.assigned_members = [...out.selected_members];
						local.assigned_count = out.selected_members.length;
					}
					if (cint_or_zero(out.required_members)) {
						local.required_members = cint_or_zero(out.required_members);
					}
				}

				const warning = cint_or_zero(out.shortage_count) > 0 || cint_or_zero(out.is_fallback);
				frappe.show_alert(
					{
						message: __('Auto dispatched {0}. Team: {1}, Assigned: {2}/{3}', [
							appointment,
							out.team || '-',
							cint_or_zero(out.assigned_count),
							cint_or_one(out.required_members),
						]),
						indicator: warning ? 'orange' : 'green',
					},
					8
				);
				this.apply_client_filters_and_render();
			},
		});
	}

	apply_best_slot_selected() {
		if (!this.selected_appointment) {
			frappe.msgprint(__('Select an appointment row first.'));
			return;
		}
		this.apply_best_slot_for_appointment(this.selected_appointment);
	}

	apply_best_slot_for_appointment(appointment, force_recalculate = 0) {
		if (!appointment) return;
		if (!this.can_leave_with_unsaved_assignment()) return;
		this.flush_board_autosave();

		frappe.call({
			method: 'service_appointment.service_appointment.page.service_assignment_workstation.service_assignment_workstation.apply_best_slot_for_appointment',
			args: {
				appointment,
				date: this.filters.date,
				force_recalculate: force_recalculate ? 1 : 0,
			},
			freeze: true,
			freeze_message: __('Applying best slot and dispatch...'),
			callback: (r) => {
				const out = r.message || {};
				if (out.status !== 'success') {
					frappe.msgprint(out.message || __('Could not apply best slot.'));
					return;
				}

				const local = this.by_name[appointment] || (this.raw_appointments || []).find((row) => row.name === appointment);
				if (local) {
					if (out.team) local.team = out.team;
					if (out.slot_applied) {
						local.date = out.slot_applied.date || local.date;
						local.time = out.slot_applied.time || local.time;
						local.duration = cint_or_zero(out.slot_applied.duration) || local.duration;
					}
					local.assignment_note = out.assignment_note || local.assignment_note;
					local.assignment_state = out.assignment_state || local.assignment_state;
					local.assignment_locked = cint_or_zero(out.assignment_locked);
					if (out.expected_modified) {
						local.modified = out.expected_modified;
					}
					if (Array.isArray(out.selected_members)) {
						local.assigned_members = [...out.selected_members];
						local.assigned_count = out.selected_members.length;
					}
					if (cint_or_zero(out.required_members)) {
						local.required_members = cint_or_zero(out.required_members);
					}
				}

				const warning = cint_or_zero(out.shortage_count) > 0 || cint_or_zero(out.is_fallback);
				frappe.show_alert(
					{
						message: __('Best slot applied for {0}. Team: {1}, Assigned: {2}/{3}', [
							appointment,
							out.team || '-',
							cint_or_zero(out.assigned_count),
							cint_or_one(out.required_members),
						]),
						indicator: warning ? 'orange' : 'green',
					},
					8
				);

				this.apply_client_filters_and_render();
			},
		});
	}

	toggle_row_lock(appointment, locked, done) {
		if (!appointment) return;
		frappe.call({
			method: 'service_appointment.service_appointment.page.service_assignment_workstation.service_assignment_workstation.set_assignment_lock',
			args: { appointment, locked: locked ? 1 : 0 },
			callback: (r) => {
				const out = r.message || {};
				if (out.status === 'success') {
					const local = this.by_name[appointment] || {};
					local.assignment_locked = out.assignment_locked;
					local.assignment_state = out.assignment_state;
					local.modified = out.expected_modified || local.modified;
					this.render_appointments();
					frappe.show_alert({ message: locked ? __('Assignment locked') : __('Assignment unlocked'), indicator: 'green' });
					if (typeof done === 'function') done();
				}
			},
		});
	}

	extract_address(address) {
		if (!address) return '';
		const text = $('<div>').html(address).text().replace(/\s+/g, ' ').trim();
		return text;
	}

	escape_html(value) {
		return frappe.utils.escape_html((value || '').toString());
	}
};

function cint_or_one(value) {
	const parsed = parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

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
