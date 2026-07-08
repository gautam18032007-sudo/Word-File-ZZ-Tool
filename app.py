"""Contract Generator — Desktop Tool (Tkinter).

Run: python app.py
No server, no browser. Reads Google Sheets, fills templates/*.docx, converts to PDF
via LibreOffice, writes to output/brands/ or output/employees/, logs to output/contracts.json.
"""
import os
import sys
import threading
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional

import tkinter as tk
from tkinter import ttk, messagebox

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')

from engines import sheets, pf, template, pdf as pdf_engine, contract_number, store
from engines.utils import format_inr, number_to_words, format_date

OUTPUT_DIR = ROOT / 'output'
BRANDS_DIR = OUTPUT_DIR / 'brands'
EMPLOYEES_DIR = OUTPUT_DIR / 'employees'
BRANDS_DIR.mkdir(parents=True, exist_ok=True)
EMPLOYEES_DIR.mkdir(parents=True, exist_ok=True)

FONT_LABEL = ('Segoe UI', 9)
FONT_HEADING = ('Segoe UI', 10, 'bold')
FONT_MONO = ('Consolas', 9)


def run_in_background(fn, on_done, on_error=None):
    """Run fn() on a worker thread; marshal the result (or exception) back to the
    Tk main thread via root.after so long operations (Sheets fetch, LibreOffice)
    never freeze the GUI."""
    def worker():
        try:
            result = fn()
        except Exception as e:  # noqa: BLE001 - surfaced to the user via callback
            # Bind e as a default arg — Python clears the `except ... as e` name when
            # the block exits, but this lambda runs later via root.after, so a lazy
            # closure over `e` would raise NameError instead of showing the real error.
            if on_error:
                root_ref.after(0, lambda err=e: on_error(err))
            else:
                root_ref.after(0, lambda err=e: messagebox.showerror('Error', str(err)))
            return
        root_ref.after(0, lambda: on_done(result))
    threading.Thread(target=worker, daemon=True).start()


root_ref: Optional[tk.Tk] = None


class BrandTab(ttk.Frame):
    def __init__(self, master, on_generated):
        super().__init__(master, padding=12)
        self.on_generated = on_generated
        self.brands: list[sheets.BrandRow] = []
        self.selected: Optional[sheets.BrandRow] = None

        self.columnconfigure(0, weight=1)
        self.columnconfigure(1, weight=1)

        # ── Left: sheet + record picker ──────────────────────────────
        left = ttk.LabelFrame(self, text='Google Sheet', padding=10)
        left.grid(row=0, column=0, sticky='nsew', padx=(0, 8))
        left.columnconfigure(0, weight=1)

        ttk.Label(left, text='Sheet URL / ID', font=FONT_LABEL).grid(row=0, column=0, sticky='w')
        url_row = ttk.Frame(left)
        url_row.grid(row=1, column=0, sticky='ew', pady=(2, 8))
        url_row.columnconfigure(0, weight=1)
        self.sheet_url = tk.StringVar()
        ttk.Entry(url_row, textvariable=self.sheet_url).grid(row=0, column=0, sticky='ew')
        ttk.Button(url_row, text='Load', command=self.load_brands).grid(row=0, column=1, padx=(6, 0))

        ttk.Separator(left).grid(row=2, column=0, sticky='ew', pady=6)

        ttk.Label(left, text='Select Brand', font=FONT_LABEL).grid(row=3, column=0, sticky='w')
        self.brand_combo = ttk.Combobox(left, state='readonly')
        self.brand_combo.grid(row=4, column=0, sticky='ew', pady=(2, 8))
        self.brand_combo.bind('<<ComboboxSelected>>', self.on_select_brand)

        self.detail_text = tk.Text(left, height=10, width=38, font=FONT_MONO, state='disabled',
                                    background='#f5f5f5', relief='flat')
        self.detail_text.grid(row=5, column=0, sticky='nsew')
        left.rowconfigure(5, weight=1)

        self.status_lbl = ttk.Label(left, text='', foreground='#666', wraplength=280)
        self.status_lbl.grid(row=6, column=0, sticky='w', pady=(6, 0))

        # ── Right: commercial details + preview + generate ──────────
        right = ttk.LabelFrame(self, text='Commercial Terms', padding=10)
        right.grid(row=0, column=1, sticky='nsew')
        right.columnconfigure(0, weight=1)
        right.columnconfigure(1, weight=1)

        ttk.Label(right, text='Location', font=FONT_LABEL).grid(row=0, column=0, sticky='w')
        self.location = tk.StringVar(value='SWN')
        loc_combo = ttk.Combobox(right, textvariable=self.location, state='readonly',
                                  values=['SWN', 'KLJ', 'BOTH'])
        loc_combo.grid(row=1, column=0, sticky='ew', padx=(0, 4), pady=(2, 8))
        loc_combo.bind('<<ComboboxSelected>>', self.refresh_form)

        ttk.Label(right, text='Contract Type', font=FONT_LABEL).grid(row=0, column=1, sticky='w')
        self.contract_type = tk.StringVar(value='MONTH')
        type_combo = ttk.Combobox(right, textvariable=self.contract_type, state='readonly',
                                   values=['MONTH', 'SKU'])
        type_combo.grid(row=1, column=1, sticky='ew', padx=(4, 0), pady=(2, 8))
        type_combo.bind('<<ComboboxSelected>>', self.refresh_form)

        self.amount_frame = ttk.Frame(right)
        self.amount_frame.grid(row=2, column=0, columnspan=2, sticky='ew')
        self.amount_frame.columnconfigure(0, weight=1)
        self.amount_frame.columnconfigure(1, weight=1)

        self.amount_per_month = tk.StringVar()
        self.amount_per_sku = tk.StringVar()
        self.amount_swn = tk.StringVar()
        self.amount_klj = tk.StringVar()
        self.no_of_months = tk.StringVar()
        self.no_of_sku = tk.StringVar()

        for var in (self.amount_per_month, self.amount_per_sku, self.amount_swn,
                    self.amount_klj, self.no_of_months, self.no_of_sku):
            var.trace_add('write', lambda *_: self.update_preview())

        row = 4
        ttk.Label(right, text='Commission %', font=FONT_LABEL).grid(row=row, column=0, sticky='w', pady=(8, 0))
        self.commission_pct = tk.StringVar()
        self.commission_pct.trace_add('write', lambda *_: self.update_preview())
        ttk.Entry(right, textvariable=self.commission_pct).grid(row=row + 1, column=0, sticky='ew', padx=(0, 4))

        ttk.Label(right, text='Effective Date (YYYY-MM-DD)', font=FONT_LABEL).grid(row=row, column=1, sticky='w', pady=(8, 0))
        self.effective_date = tk.StringVar()
        ttk.Entry(right, textvariable=self.effective_date).grid(row=row + 1, column=1, sticky='ew', padx=(4, 0))

        row += 2
        ttk.Label(right, text='Stamping Date (YYYY-MM-DD)', font=FONT_LABEL).grid(row=row, column=0, sticky='w', pady=(8, 0))
        self.stamping_date = tk.StringVar()
        ttk.Entry(right, textvariable=self.stamping_date).grid(row=row + 1, column=0, sticky='ew', padx=(0, 4))

        row += 2
        ttk.Separator(right).grid(row=row, column=0, columnspan=2, sticky='ew', pady=10)
        row += 1

        ttk.Label(right, text='Live Preview', font=FONT_HEADING).grid(row=row, column=0, columnspan=2, sticky='w')
        row += 1
        self.preview_text = tk.Text(right, height=6, wrap='word', font=FONT_MONO,
                                     state='disabled', background='#f5f5f5', relief='flat')
        self.preview_text.grid(row=row, column=0, columnspan=2, sticky='nsew', pady=(4, 8))
        right.rowconfigure(row, weight=1)
        row += 1

        self.generate_btn = ttk.Button(right, text='Generate Brand Contract', command=self.generate)
        self.generate_btn.grid(row=row, column=0, columnspan=2, sticky='ew', ipady=4)

        self.result_lbl = ttk.Label(right, text='', foreground='#0a7d2c', wraplength=380)
        self.result_lbl.grid(row=row + 1, column=0, columnspan=2, sticky='w', pady=(6, 0))

        self.refresh_form()

    # ── data loading ──────────────────────────────────────────────
    def load_brands(self):
        self.status_lbl.config(text='Loading...', foreground='#666')
        sheet_id = sheets.extract_sheet_id(self.sheet_url.get()) or None

        def fetch():
            return sheets.fetch_brand_rows(sheet_id)

        def done(rows):
            self.brands = rows
            self.brand_combo['values'] = [b.legal_name for b in rows]
            self.status_lbl.config(text=f'{len(rows)} brand(s) loaded.', foreground='#0a7d2c')

        def err(e):
            self.status_lbl.config(text=str(e), foreground='#b00020')

        run_in_background(fetch, done, err)

    def on_select_brand(self, _event=None):
        idx = self.brand_combo.current()
        if idx < 0 or idx >= len(self.brands):
            return
        self.selected = self.brands[idx]
        b = self.selected
        lines = [
            f'Legal Name    : {b.legal_name}',
            f'Category      : {b.brand_category}',
            f'Address       : {b.address}',
            f'Email         : {b.email}',
            f'Phone         : {b.phone}',
            f'Contact Person: {b.contact_person}',
        ]
        self.detail_text.config(state='normal')
        self.detail_text.delete('1.0', 'end')
        self.detail_text.insert('1.0', '\n'.join(lines))
        self.detail_text.config(state='disabled')
        self.result_lbl.config(text='')
        self.update_preview()

    # ── dynamic form ─────────────────────────────────────────────
    def refresh_form(self, _event=None):
        for w in self.amount_frame.winfo_children():
            w.destroy()

        f = self.amount_frame
        if self.location.get() == 'BOTH':
            ttk.Label(f, text='Amount — SWN (Rs)', font=FONT_LABEL).grid(row=0, column=0, sticky='w')
            ttk.Entry(f, textvariable=self.amount_swn).grid(row=1, column=0, sticky='ew', padx=(0, 4))
            ttk.Label(f, text='Amount — KLJ (Rs)', font=FONT_LABEL).grid(row=0, column=1, sticky='w')
            ttk.Entry(f, textvariable=self.amount_klj).grid(row=1, column=1, sticky='ew', padx=(4, 0))
            row = 2
            if self.contract_type.get() == 'SKU':
                ttk.Label(f, text='No. of SKUs', font=FONT_LABEL).grid(row=row, column=0, sticky='w', pady=(8, 0))
                ttk.Entry(f, textvariable=self.no_of_sku).grid(row=row + 1, column=0, sticky='ew', padx=(0, 4))
            ttk.Label(f, text='No. of Months', font=FONT_LABEL).grid(row=row, column=1, sticky='w', pady=(8, 0))
            ttk.Entry(f, textvariable=self.no_of_months).grid(row=row + 1, column=1, sticky='ew', padx=(4, 0))
        elif self.contract_type.get() == 'MONTH':
            ttk.Label(f, text='Amount / Month (Rs)', font=FONT_LABEL).grid(row=0, column=0, sticky='w')
            ttk.Entry(f, textvariable=self.amount_per_month).grid(row=1, column=0, sticky='ew', padx=(0, 4))
            ttk.Label(f, text='Number of Months', font=FONT_LABEL).grid(row=0, column=1, sticky='w')
            ttk.Entry(f, textvariable=self.no_of_months).grid(row=1, column=1, sticky='ew', padx=(4, 0))
        else:  # SKU
            ttk.Label(f, text='Amount / SKU (Rs)', font=FONT_LABEL).grid(row=0, column=0, sticky='w')
            ttk.Entry(f, textvariable=self.amount_per_sku).grid(row=1, column=0, sticky='ew', padx=(0, 4))
            ttk.Label(f, text='No. of SKUs', font=FONT_LABEL).grid(row=0, column=1, sticky='w')
            ttk.Entry(f, textvariable=self.no_of_sku).grid(row=1, column=1, sticky='ew', padx=(4, 0))
            ttk.Label(f, text='No. of Months', font=FONT_LABEL).grid(row=2, column=0, sticky='w', pady=(8, 0))
            ttk.Entry(f, textvariable=self.no_of_months).grid(row=3, column=0, sticky='ew', padx=(0, 4))
        self.update_preview()

    # ── calculation shared by preview + generate ────────────────
    def _calc(self):
        """Returns (location_text, total_amount, display_amount, commercial_clause) or None if inputs incomplete."""
        location = self.location.get()
        contract_type = self.contract_type.get()

        def num(v: tk.StringVar) -> float:
            try:
                return float(v.get())
            except ValueError:
                return 0.0

        location_text = {'SWN': 'SWN setup', 'KLJ': 'KLJ setup', 'BOTH': 'SWN and KLJ setups'}[location]

        if location == 'BOTH':
            a_swn, a_klj, months, sku = num(self.amount_swn), num(self.amount_klj), num(self.no_of_months), num(self.no_of_sku)
            if not (a_swn and a_klj and months):
                return None
            if contract_type == 'MONTH':
                total = (a_swn + a_klj) * months
                clause = (f'An advanced fixed fee of {format_inr(a_swn)} per Month at SWN and '
                          f'{format_inr(a_klj)} per Month at KLJ, for {int(months)} months, '
                          f'totalling to {format_inr(total)} across both setups.')
            else:
                if not sku:
                    return None
                total = (a_swn + a_klj) * sku * months
                clause = (f'An advanced fixed fee of {format_inr(a_swn)} per SKU at SWN and '
                          f'{format_inr(a_klj)} per SKU at KLJ, for {int(sku)} SKUs for {int(months)} months, '
                          f'totalling {format_inr(total)} across both setups.')
            return location_text, total, a_swn, clause

        if contract_type == 'MONTH':
            a, months = num(self.amount_per_month), num(self.no_of_months)
            if not (a and months):
                return None
            total = a * months
            clause = (f'An advanced fixed fee of {format_inr(a)} per Month for {int(months)} months, '
                       f'totalling to {format_inr(total)} at our {location_text}.')
            return location_text, total, a, clause

        a, sku, months = num(self.amount_per_sku), num(self.no_of_sku), num(self.no_of_months)
        if not (a and sku and months):
            return None
        total = a * sku * months
        clause = (f'An advanced fixed fee of {format_inr(a)} per SKU for {int(sku)} SKUs for {int(months)} months, '
                   f'totalling {format_inr(total)} at our {location_text}.')
        return location_text, total, a, clause

    def update_preview(self):
        self.preview_text.config(state='normal')
        self.preview_text.delete('1.0', 'end')
        calc = self._calc()
        if not self.selected:
            self.preview_text.insert('1.0', 'Select a brand to see the preview.')
        elif not calc:
            self.preview_text.insert('1.0', 'Fill in amount / months / SKU count to see the preview.')
        else:
            location_text, total, _amt, clause = calc
            comm = self.commission_pct.get()
            lines = [clause]
            if comm:
                lines.append(f'A commission of {comm}% on the sale price of each product sold.')
            self.preview_text.insert('1.0', '\n\n'.join(lines))
        self.preview_text.config(state='disabled')

    # ── generation ───────────────────────────────────────────────
    def generate(self):
        if not self.selected:
            messagebox.showwarning('Missing data', 'Select a brand first.')
            return
        calc = self._calc()
        if not calc:
            messagebox.showwarning('Missing data', 'Fill in the commercial amount fields first.')
            return
        if not self.effective_date.get() or not self.stamping_date.get():
            messagebox.showwarning('Missing data', 'Enter Effective Date and Stamping Date (YYYY-MM-DD).')
            return
        if not self.commission_pct.get():
            messagebox.showwarning('Missing data', 'Enter Commission %.')
            return

        b = self.selected
        location_text, total_amount, display_amount, commercial_clause = calc
        commission_pct = self.commission_pct.get()

        try:
            effective_date_fmt = format_date(self.effective_date.get())
            stamping_date_fmt = format_date(self.stamping_date.get())
        except ValueError:
            messagebox.showerror('Bad date', 'Dates must be in YYYY-MM-DD format.')
            return

        self.generate_btn.config(state='disabled', text='Generating...')

        def work():
            contract_no = contract_number.next_contract_number('BRAND')
            data = {
                'LEGAL_NAME': b.legal_name,
                'BRAND_CATEGORY': b.brand_category,
                'ADDRESS': b.address,
                'EMAIL': b.email,
                'PHONE': b.phone,
                'CONTACT_PERSON': b.contact_person,
                'STAMPING_DATE': stamping_date_fmt,
                'EFFECTIVE_DATE': effective_date_fmt,
                'LOCATION_TEXT': location_text,
                'AMOUNT': format_inr(display_amount),
                'NO_OF_MONTHS': self.no_of_months.get(),
                'NO_OF_SKUS': self.no_of_sku.get(),
                'TOTAL_AMOUNT': format_inr(total_amount),
                'COMMISSION_PCT': f'{commission_pct}%',
            }
            docx_bytes = template.render_docx('brand-contract-template.docx', data)
            docx_name = contract_number.build_filename(contract_no, b.legal_name, 'docx')
            (BRANDS_DIR / docx_name).write_bytes(docx_bytes)

            pdf_name = None
            try:
                pdf_bytes = pdf_engine.docx_to_pdf(docx_bytes)
                pdf_name = contract_number.build_filename(contract_no, b.legal_name, 'pdf')
                (BRANDS_DIR / pdf_name).write_bytes(pdf_bytes)
            except pdf_engine.PdfError:
                pass  # DOCX still generated; PDF optional

            store.append_contract(store.ContractRecord(
                contract_no=contract_no, type='brand', party_name=b.legal_name,
                generated_at=datetime.now().isoformat(), docx=docx_name, pdf=pdf_name,
                folder='brands', location=self.location.get(), total_amount=total_amount,
            ))
            return contract_no, docx_name, pdf_name

        def done(result):
            contract_no, docx_name, pdf_name = result
            self.generate_btn.config(state='normal', text='Generate Brand Contract')
            msg = f'{contract_no} generated.\nDOCX: {docx_name}'
            if pdf_name:
                msg += f'\nPDF: {pdf_name}'
            else:
                msg += '\nPDF skipped (LibreOffice not available).'
            self.result_lbl.config(text=msg)
            self.on_generated()

        def err(e):
            self.generate_btn.config(state='normal', text='Generate Brand Contract')
            messagebox.showerror('Generation failed', f'{e}\n\n{traceback.format_exc()}')

        run_in_background(work, done, err)


class EmployeeTab(ttk.Frame):
    def __init__(self, master, on_generated):
        super().__init__(master, padding=12)
        self.on_generated = on_generated
        self.employees: list[sheets.EmployeeRow] = []
        self.selected: Optional[sheets.EmployeeRow] = None

        self.columnconfigure(0, weight=1)
        self.columnconfigure(1, weight=1)

        # ── Left: sheet + record picker ──────────────────────────────
        left = ttk.LabelFrame(self, text='Google Sheet', padding=10)
        left.grid(row=0, column=0, sticky='nsew', padx=(0, 8))
        left.columnconfigure(0, weight=1)

        ttk.Label(left, text='Sheet URL / ID', font=FONT_LABEL).grid(row=0, column=0, sticky='w')
        url_row = ttk.Frame(left)
        url_row.grid(row=1, column=0, sticky='ew', pady=(2, 8))
        url_row.columnconfigure(0, weight=1)
        self.sheet_url = tk.StringVar()
        ttk.Entry(url_row, textvariable=self.sheet_url).grid(row=0, column=0, sticky='ew')
        ttk.Button(url_row, text='Load', command=self.load_employees).grid(row=0, column=1, padx=(6, 0))

        ttk.Separator(left).grid(row=2, column=0, sticky='ew', pady=6)

        ttk.Label(left, text='Select Employee', font=FONT_LABEL).grid(row=3, column=0, sticky='w')
        self.emp_combo = ttk.Combobox(left, state='readonly')
        self.emp_combo.grid(row=4, column=0, sticky='ew', pady=(2, 8))
        self.emp_combo.bind('<<ComboboxSelected>>', self.on_select_employee)

        self.detail_text = tk.Text(left, height=10, width=38, font=FONT_MONO, state='disabled',
                                    background='#f5f5f5', relief='flat')
        self.detail_text.grid(row=5, column=0, sticky='nsew')
        left.rowconfigure(5, weight=1)

        self.status_lbl = ttk.Label(left, text='', foreground='#666', wraplength=280)
        self.status_lbl.grid(row=6, column=0, sticky='w', pady=(6, 0))

        # ── Right: CTC / joining / PF + salary preview + generate ───
        right = ttk.LabelFrame(self, text='Contract Details', padding=10)
        right.grid(row=0, column=1, sticky='nsew')
        right.columnconfigure(0, weight=1)
        right.columnconfigure(1, weight=1)

        ttk.Label(right, text='Annual CTC (Rs)', font=FONT_LABEL).grid(row=0, column=0, sticky='w')
        self.annual_ctc = tk.StringVar()
        self.annual_ctc.trace_add('write', lambda *_: self.update_salary_preview())
        ttk.Entry(right, textvariable=self.annual_ctc).grid(row=1, column=0, sticky='ew', padx=(0, 4))

        ttk.Label(right, text='Joining Date (YYYY-MM-DD)', font=FONT_LABEL).grid(row=0, column=1, sticky='w')
        self.joining_date = tk.StringVar()
        ttk.Entry(right, textvariable=self.joining_date).grid(row=1, column=1, sticky='ew', padx=(4, 0))

        ttk.Label(right, text='Provident Fund', font=FONT_LABEL).grid(row=2, column=0, sticky='w', pady=(8, 0))
        self.pf_enabled = tk.BooleanVar(value=True)
        pf_row = ttk.Frame(right)
        pf_row.grid(row=3, column=0, sticky='ew')
        ttk.Radiobutton(pf_row, text='PF Yes', variable=self.pf_enabled, value=True,
                         command=self.update_salary_preview).pack(side='left', padx=(0, 12))
        ttk.Radiobutton(pf_row, text='PF No', variable=self.pf_enabled, value=False,
                         command=self.update_salary_preview).pack(side='left')

        # Gender drives the pronoun engine (He/Him/His vs She/Her/Her in the contract
        # text). Auto-filled from the sheet's Gender column when a record is selected,
        # but left editable here in case that column is blank or inconsistent.
        ttk.Label(right, text='Gender', font=FONT_LABEL).grid(row=2, column=1, sticky='w', pady=(8, 0))
        self.gender = tk.StringVar(value='Male')
        ttk.Combobox(right, textvariable=self.gender, state='readonly',
                     values=['Male', 'Female']).grid(row=3, column=1, sticky='ew', padx=(4, 0))

        ttk.Separator(right).grid(row=4, column=0, columnspan=2, sticky='ew', pady=10)

        ttk.Label(right, text='Annexure-A — Salary Preview', font=FONT_HEADING).grid(row=5, column=0, columnspan=2, sticky='w')
        self.salary_text = tk.Text(right, height=10, wrap='none', font=FONT_MONO,
                                    state='disabled', background='#f5f5f5', relief='flat')
        self.salary_text.grid(row=6, column=0, columnspan=2, sticky='nsew', pady=(4, 8))
        right.rowconfigure(6, weight=1)

        self.generate_btn = ttk.Button(right, text='Generate Employee Contract', command=self.generate)
        self.generate_btn.grid(row=7, column=0, columnspan=2, sticky='ew', ipady=4)

        self.result_lbl = ttk.Label(right, text='', foreground='#0a7d2c', wraplength=380)
        self.result_lbl.grid(row=8, column=0, columnspan=2, sticky='w', pady=(6, 0))

    def load_employees(self):
        self.status_lbl.config(text='Loading...', foreground='#666')
        sheet_id = sheets.extract_sheet_id(self.sheet_url.get()) or None

        def fetch():
            return sheets.fetch_employee_rows(sheet_id)

        def done(rows):
            self.employees = rows
            self.emp_combo['values'] = [f'{e.name} — {e.designation}' for e in rows]
            self.status_lbl.config(text=f'{len(rows)} employee(s) loaded.', foreground='#0a7d2c')

        def err(e):
            self.status_lbl.config(text=str(e), foreground='#b00020')

        run_in_background(fetch, done, err)

    def on_select_employee(self, _event=None):
        idx = self.emp_combo.current()
        if idx < 0 or idx >= len(self.employees):
            return
        self.selected = self.employees[idx]
        e = self.selected
        lines = [
            f"Name          : {e.name}",
            f"Father's Name : {e.father_name}",
            f'Designation   : {e.designation}',
            f'Department    : {e.department}',
            f'Email         : {e.email}',
            f'Phone         : {e.phone}',
            f'PAN           : {e.pan}',
            f'Aadhar        : {e.aadhar}',
        ]
        self.detail_text.config(state='normal')
        self.detail_text.delete('1.0', 'end')
        self.detail_text.insert('1.0', '\n'.join(lines))
        self.detail_text.config(state='disabled')
        self.gender.set('Female' if e.gender.strip().lower() == 'female' else 'Male')
        self.result_lbl.config(text='')

    def update_salary_preview(self):
        self.salary_text.config(state='normal')
        self.salary_text.delete('1.0', 'end')
        try:
            ctc = float(self.annual_ctc.get())
        except ValueError:
            ctc = 0
        if ctc <= 0:
            self.salary_text.insert('1.0', 'Enter Annual CTC to see the salary breakup.')
            self.salary_text.config(state='disabled')
            return

        s = pf.calc_salary(ctc, self.pf_enabled.get())
        rows = [
            ('Basic', s.basic), ('HRA', s.hra), ('Conveyance', s.conveyance),
            ('PF Employer', s.pf_employer), ('Special Allowance', s.special_allowance),
        ]
        lines = [f'{label:<20}{format_inr(val):>14}' for label, val in rows]
        lines.append('-' * 34)
        lines.append(f'{"Total CTC":<20}{format_inr(s.monthly_ctc):>14}')
        lines.append(f'{"(-) PF Employee":<20}{"- " + format_inr(s.pf_employee):>14}')
        lines.append('-' * 34)
        lines.append(f'{"Salary In Hand":<20}{format_inr(s.salary_in_hand):>14}')
        self.salary_text.insert('1.0', '\n'.join(lines))
        self.salary_text.config(state='disabled')

    def generate(self):
        if not self.selected:
            messagebox.showwarning('Missing data', 'Select an employee first.')
            return
        try:
            ctc = float(self.annual_ctc.get())
        except ValueError:
            messagebox.showwarning('Missing data', 'Enter a valid Annual CTC.')
            return
        if ctc <= 0:
            messagebox.showwarning('Missing data', 'Enter a valid Annual CTC.')
            return
        if not self.joining_date.get():
            messagebox.showwarning('Missing data', 'Enter Joining Date (YYYY-MM-DD).')
            return
        try:
            joining_date_fmt = format_date(self.joining_date.get())
        except ValueError:
            messagebox.showerror('Bad date', 'Joining Date must be in YYYY-MM-DD format.')
            return

        e = self.selected
        pf_enabled = self.pf_enabled.get()
        gender = self.gender.get()  # read on the main thread — the combobox may have
                                     # been corrected from the sheet's raw value
        self.generate_btn.config(state='disabled', text='Generating...')

        def work():
            s = pf.calc_salary(ctc, pf_enabled)
            contract_no = contract_number.next_contract_number('EMP')

            is_female = gender.strip().lower() == 'female'
            pronouns = (
                {'SUBJECT': 'she', 'SUBJECT_CAP': 'She', 'OBJECT': 'her', 'OBJECT_CAP': 'Her',
                 'POSSESSIVE': 'her', 'POSSESSIVE_CAP': 'Her'}
                if is_female else
                {'SUBJECT': 'he', 'SUBJECT_CAP': 'He', 'OBJECT': 'him', 'OBJECT_CAP': 'Him',
                 'POSSESSIVE': 'his', 'POSSESSIVE_CAP': 'His'}
            )

            data = {
                'EMPLOYEE_NAME': e.name,
                'FATHER_NAME': e.father_name,
                'EMPLOYEE_ADDRESS': e.address,
                'PHONE': e.phone,
                'EMAIL': e.email,
                'PAN': e.pan,
                'AADHAR': e.aadhar,
                'DESIGNATION': e.designation,
                'DEPARTMENT': e.department,
                'JOINING_DATE': joining_date_fmt,
                'MONTHLY_CTC': format_inr(s.monthly_ctc),
                'MONTHLY_CTC_WORDS': number_to_words(s.monthly_ctc),
                'ANNUAL_CTC': format_inr(s.annual_ctc),
                'ANNUAL_CTC_WORDS': number_to_words(s.annual_ctc),
                'PRONOUN_SUBJECT': pronouns['SUBJECT'],
                'PRONOUN_SUBJECT_CAP': pronouns['SUBJECT_CAP'],
                'PRONOUN_OBJECT': pronouns['OBJECT'],
                'PRONOUN_OBJECT_CAP': pronouns['OBJECT_CAP'],
                'PRONOUN_POSSESSIVE': pronouns['POSSESSIVE'],
                'PRONOUN_POSSESSIVE_CAP': pronouns['POSSESSIVE_CAP'],
                'ANN_BASIC': format_inr(s.basic),
                'ANN_HRA': format_inr(s.hra),
                'ANN_CONVEYANCE': format_inr(s.conveyance),
                'ANN_PF_EMPLOYER': format_inr(s.pf_employer),
                'ANN_SPECIAL_ALLOWANCE': format_inr(s.special_allowance),
                'ANN_TOTAL_CTC': format_inr(s.monthly_ctc),
                'ANN_PF_EMPLOYEE': format_inr(s.pf_employee),
                'ANN_SALARY_IN_HAND': format_inr(s.salary_in_hand),
                'ANN_BASIC_ANNUAL': format_inr(s.basic * 12),
                'ANN_HRA_ANNUAL': format_inr(s.hra * 12),
                'ANN_CONVEYANCE_ANNUAL': format_inr(s.conveyance * 12),
                'ANN_PF_EMPLOYER_ANNUAL': format_inr(s.pf_employer * 12),
                'ANN_SPECIAL_ALLOWANCE_ANNUAL': format_inr(s.special_allowance * 12),
                'ANN_TOTAL_CTC_ANNUAL': format_inr(s.annual_ctc),
                'ANN_PF_EMPLOYEE_ANNUAL': format_inr(s.pf_employee * 12),
                'ANN_SALARY_IN_HAND_ANNUAL': format_inr(s.salary_in_hand * 12),
            }
            docx_bytes = template.render_docx('employee-contract-template.docx', data)
            docx_name = contract_number.build_filename(contract_no, e.name, 'docx')
            (EMPLOYEES_DIR / docx_name).write_bytes(docx_bytes)

            pdf_name = None
            try:
                pdf_bytes = pdf_engine.docx_to_pdf(docx_bytes)
                pdf_name = contract_number.build_filename(contract_no, e.name, 'pdf')
                (EMPLOYEES_DIR / pdf_name).write_bytes(pdf_bytes)
            except pdf_engine.PdfError:
                pass

            store.append_contract(store.ContractRecord(
                contract_no=contract_no, type='employee', party_name=e.name,
                generated_at=datetime.now().isoformat(), docx=docx_name, pdf=pdf_name,
                folder='employees', annual_ctc=s.annual_ctc, designation=e.designation,
            ))
            return contract_no, docx_name, pdf_name

        def done(result):
            contract_no, docx_name, pdf_name = result
            self.generate_btn.config(state='normal', text='Generate Employee Contract')
            msg = f'{contract_no} generated.\nDOCX: {docx_name}'
            if pdf_name:
                msg += f'\nPDF: {pdf_name}'
            else:
                msg += '\nPDF skipped (LibreOffice not available).'
            self.result_lbl.config(text=msg)
            self.on_generated()

        def err(ex):
            self.generate_btn.config(state='normal', text='Generate Employee Contract')
            messagebox.showerror('Generation failed', f'{ex}\n\n{traceback.format_exc()}')

        run_in_background(work, done, err)


class RecentContractsPanel(ttk.LabelFrame):
    def __init__(self, master):
        super().__init__(master, text='Recent Contracts', padding=10)
        columns = ('type', 'contract_no', 'party', 'date')
        self.tree = ttk.Treeview(self, columns=columns, show='headings', height=6)
        for col, label, width in [
            ('type', 'Type', 80), ('contract_no', 'Contract No', 160),
            ('party', 'Party', 220), ('date', 'Generated', 140),
        ]:
            self.tree.heading(col, text=label)
            self.tree.column(col, width=width, anchor='w')
        self.tree.pack(fill='both', expand=True, side='left')
        self.tree.bind('<Double-1>', self.open_selected)

        scroll = ttk.Scrollbar(self, orient='vertical', command=self.tree.yview)
        scroll.pack(side='right', fill='y')
        self.tree.configure(yscrollcommand=scroll.set)

        self._records: dict[str, dict] = {}
        self.refresh()

    def refresh(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        self._records.clear()
        for rec in store.read_contracts()[:20]:
            item_id = self.tree.insert('', 'end', values=(
                rec['type'].capitalize(), rec['contract_no'], rec['party_name'],
                rec['generated_at'][:10],
            ))
            self._records[item_id] = rec

    def open_selected(self, _event=None):
        sel = self.tree.selection()
        if not sel:
            return
        rec = self._records.get(sel[0])
        if not rec:
            return
        folder = OUTPUT_DIR / rec['folder']
        target = folder / (rec['pdf'] or rec['docx'])
        if target.exists():
            os.startfile(target)  # noqa: S606 - Windows-only tool, deliberate
        else:
            messagebox.showwarning('File missing', f'{target} not found on disk.')


def main():
    global root_ref
    root = tk.Tk()
    root_ref = root
    root.title('Contract Generator')
    root.geometry('980x760')
    try:
        root.iconbitmap(default='')
    except Exception:
        pass

    style = ttk.Style()
    try:
        style.theme_use('vista')
    except tk.TclError:
        style.theme_use('clam')

    container = ttk.Frame(root, padding=10)
    container.pack(fill='both', expand=True)
    container.columnconfigure(0, weight=1)
    container.rowconfigure(0, weight=3)
    container.rowconfigure(1, weight=1)

    header = ttk.Label(container, text='Contract Generator', font=('Segoe UI', 14, 'bold'))
    header.grid(row=0, column=0, sticky='nw')

    notebook = ttk.Notebook(container)
    notebook.grid(row=0, column=0, sticky='nsew', pady=(30, 10))

    recent_panel = RecentContractsPanel(container)
    recent_panel.grid(row=1, column=0, sticky='nsew')

    def on_generated():
        recent_panel.refresh()

    brand_tab = BrandTab(notebook, on_generated)
    employee_tab = EmployeeTab(notebook, on_generated)
    notebook.add(brand_tab, text='Brand Contract')
    notebook.add(employee_tab, text='Employee Contract')

    if not (ROOT / 'credentials.json').exists():
        messagebox.showwarning(
            'Google credentials not found',
            'credentials.json is missing from the project root.\n\n'
            'Sheet loading will fail until you add your Google service account key as:\n'
            f'{ROOT / "credentials.json"}'
        )

    root.mainloop()


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
    main()
