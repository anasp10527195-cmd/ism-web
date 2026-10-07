/**
 * Supabase Adapter for Ihsan Super Market (ISM)
 * Replaces Google Apps Script (google.script.run) with direct Supabase calls.
 */
(function() {
  const SUPABASE_URL = 'https://jtxcaicpbelwauawqvtg.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_ektcTT63D4xkkKv6rDXyyg_RyWP9cqE';

  async function api(path, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...(options.headers || {})
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Database request failed');
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  const handlers = {
    async loginAdmin(u, p) {
      const cleanU = String(u || '').trim();
      const cleanP = String(p || '').trim();
      const admins = await api(`Admin?Username=eq.${encodeURIComponent(cleanU)}&Password=eq.${encodeURIComponent(cleanP)}`);
      if (admins && admins.length > 0) {
        return { success: true, message: 'Signed in successfully.' };
      }
      return { success: false, message: 'Invalid admin username or password.' };
    },

    async getStudentDetails(adNo) {
      const cleanAdNo = String(adNo || '').trim();
      let students = await api(`Students?AdNo=eq.${encodeURIComponent(cleanAdNo)}`);
      if (!students || students.length === 0) {
        if (!isNaN(cleanAdNo)) {
          students = await api(`Students?AdNo=eq.${Number(cleanAdNo)}`);
        }
      }
      if (!students || students.length === 0) {
        return { success: false, message: 'Admission Number not found.' };
      }
      const student = students[0];
      const actualAdNo = String(student.AdNo);

      const purchases = await api(`Purchases?BuyerType=eq.Student&Identifier=eq.${encodeURIComponent(actualAdNo)}&order=Date.desc,Time.desc`) || [];
      const payments = await api(`payments?PayerType=eq.Student&Identifier=eq.${encodeURIComponent(actualAdNo)}&order=Date.desc,Time.desc`) || [];

      const dueAmount = purchases.reduce((sum, p) => sum + (Number(p.Price || 0) * Number(p.Qty || 1)), 0);
      const paidAmount = payments.reduce((sum, p) => sum + Number(p.Amount || 0), 0);
      const balance = dueAmount - paidAmount;

      return {
        success: true,
        student: {
          adNo: student.AdNo,
          name: student.Name,
          className: student.Class,
          photoUrl: student.PhotoUrl
        },
        dueAmount,
        paidAmount,
        balance,
        purchases: purchases.map(p => ({
          id: p.ID,
          product: p.Product,
          qty: p.Qty,
          price: p.Price,
          date: p.Date,
          time: p.Time
        })),
        payments: payments.map(p => ({
          id: p.ID,
          amount: p.Amount,
          date: p.Date,
          time: p.Time
        }))
      };
    },

    async getStudentRecord(adNo) {
      const cleanAdNo = String(adNo || '').trim();
      let students = await api(`Students?AdNo=eq.${encodeURIComponent(cleanAdNo)}`);
      if (!students || students.length === 0) {
        if (!isNaN(cleanAdNo)) {
          students = await api(`Students?AdNo=eq.${Number(cleanAdNo)}`);
        }
      }
      if (!students || students.length === 0) {
        return { success: false, message: 'Student not found.' };
      }
      const s = students[0];
      return {
        success: true,
        student: {
          adNo: s.AdNo,
          name: s.Name,
          className: s.Class,
          photoUrl: s.PhotoUrl
        }
      };
    },

    async getLiveStock() {
      const rows = await api('Stock?select=*&order=Product.asc') || [];
      return rows.filter(r => r.Product && r.Product.trim()).map(r => {
        const qty = Number(r.Qty || 0);
        return {
          id: r.ID || r.Product,
          rowKey: r.ID || r.Product,
          product: r.Product,
          name: r.Product,
          qty: qty,
          price: Number(r.Price || 0),
          status: qty > 0 ? 'In Stock' : 'Out of Stock'
        };
      });
    },

    async getStockList() {
      return this.getLiveStock();
    },

    async getAllStock() {
      return this.getLiveStock();
    },

    async getStockRecord(id) {
      const rows = await api(`Stock?ID=eq.${encodeURIComponent(id)}`);
      if (!rows || rows.length === 0) {
        return { success: false, message: 'Stock item not found.' };
      }
      const s = rows[0];
      return {
        success: true,
        stock: {
          id: s.ID,
          rowKey: s.ID,
          product: s.Product,
          name: s.Product,
          qty: s.Qty,
          price: s.Price,
          status: Number(s.Qty || 0) > 0 ? 'In Stock' : 'Out of Stock'
        }
      };
    },

    async addSingleStock(name, qty, price) {
      const id = 'STK_' + Date.now();
      await api('Stock', {
        method: 'POST',
        body: JSON.stringify([{
          ID: id,
          Product: name,
          Qty: Number(qty || 0),
          Price: Number(price || 0)
        }])
      });
      return { success: true, message: 'Stock item added successfully.' };
    },

    async updateStockRecord(id, name, qty, price) {
      await api(`Stock?ID=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          Product: name,
          Qty: Number(qty || 0),
          Price: Number(price || 0)
        })
      });
      return { success: true, message: 'Stock record updated successfully.' };
    },

    async getAllUnions() {
      const rows = await api('unions?select=*&order=Class.asc') || [];
      return rows.map(u => ({
        name: u.Name,
        className: u.Class
      }));
    },

    async getLedgerUnionList(q) {
      const all = await this.getAllUnions();
      const filter = String(q || '').trim().toLowerCase();
      if (!filter) return all;
      return all.filter(u => String(u.name).toLowerCase().includes(filter));
    },

    async searchStudents(q, className) {
      const query = String(q || '').trim();
      let path = 'Students?select=*';
      if (className) {
        path += `&Class=eq.${encodeURIComponent(className)}`;
      }
      const rows = await api(path) || [];
      const lower = query.toLowerCase();
      return rows
        .filter(s => !query || String(s.Name).toLowerCase().includes(lower) || String(s.AdNo).toLowerCase().includes(lower))
        .slice(0, 15)
        .map(s => ({
          adNo: s.AdNo,
          name: s.Name,
          className: s.Class,
          photoUrl: s.PhotoUrl
        }));
    },

    async getLedgerStudentList(className, q) {
      return this.searchStudents(q, className);
    },

    async getLedgerPage(type, identifier) {
      if (type === 'Student') {
        return this.getStudentDetails(identifier);
      }

      const cleanName = String(identifier || '').trim();
      const unions = await api(`unions?Name=eq.${encodeURIComponent(cleanName)}`);
      const union = unions && unions[0] ? unions[0] : { Name: cleanName, Class: 'General' };

      const purchases = await api(`Purchases?BuyerType=eq.Union&Identifier=eq.${encodeURIComponent(cleanName)}&order=Date.desc,Time.desc`) || [];
      const payments = await api(`payments?PayerType=eq.Union&Identifier=eq.${encodeURIComponent(cleanName)}&order=Date.desc,Time.desc`) || [];

      const dueAmount = purchases.reduce((sum, p) => sum + (Number(p.Price || 0) * Number(p.Qty || 1)), 0);
      const paidAmount = payments.reduce((sum, p) => sum + Number(p.Amount || 0), 0);
      const balance = dueAmount - paidAmount;

      return {
        success: true,
        union: {
          name: union.Name,
          className: union.Class
        },
        dueAmount,
        paidAmount,
        balance,
        purchases: purchases.map(p => ({
          id: p.ID,
          product: p.Product,
          qty: p.Qty,
          price: p.Price,
          date: p.Date,
          time: p.Time
        })),
        payments: payments.map(p => ({
          id: p.ID,
          amount: p.Amount,
          date: p.Date,
          time: p.Time
        }))
      };
    },

    async recordMultiplePurchases(buyerType, identifier, items) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString();

      const inserts = items.map((item, idx) => ({
        ID: 'PUR_' + Date.now() + '_' + idx,
        BuyerType: buyerType,
        Identifier: String(identifier).trim(),
        Product: item.product,
        Qty: Number(item.qty || 1),
        Price: Number(item.price || 0),
        Date: dateStr,
        Time: timeStr
      }));

      await api('Purchases', {
        method: 'POST',
        body: JSON.stringify(inserts)
      });

      for (const item of items) {
        try {
          const current = await api(`Stock?Product=eq.${encodeURIComponent(item.product)}`);
          if (current && current.length > 0) {
            const newQty = Math.max(0, Number(current[0].Qty || 0) - Number(item.qty || 1));
            await api(`Stock?ID=eq.${encodeURIComponent(current[0].ID)}`, {
              method: 'PATCH',
              body: JSON.stringify({ Qty: newQty })
            });
          }
        } catch (_) {}
      }

      return { success: true, message: 'Purchases recorded successfully.' };
    },

    async recordPayment(payerType, identifier, amount) {
      const now = new Date();
      await api('payments', {
        method: 'POST',
        body: JSON.stringify([{
          ID: 'PAY_' + Date.now(),
          PayerType: payerType,
          Identifier: String(identifier).trim(),
          Amount: Number(amount || 0),
          Date: now.toISOString().split('T')[0],
          Time: now.toLocaleTimeString()
        }])
      });
      return { success: true, message: 'Payment recorded successfully.' };
    },

    async getPurchaseRecord(id) {
      const rows = await api(`Purchases?ID=eq.${encodeURIComponent(id)}`);
      if (!rows || rows.length === 0) {
        return { success: false, message: 'Purchase record not found.' };
      }
      const p = rows[0];
      return {
        success: true,
        purchase: {
          id: p.ID,
          buyerType: p.BuyerType,
          identifier: p.Identifier,
          product: p.Product,
          qty: p.Qty,
          price: p.Price
        }
      };
    },

    async updatePurchaseRecord(id, buyerType, identifier, product, qty, price) {
      await api(`Purchases?ID=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          BuyerType: buyerType,
          Identifier: identifier,
          Product: product,
          Qty: Number(qty || 1),
          Price: Number(price || 0)
        })
      });
      return { success: true, message: 'Purchase updated successfully.' };
    },

    async editPayment(id, amount) {
      await api(`payments?ID=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          Amount: Number(amount || 0)
        })
      });
      return { success: true, message: 'Payment updated successfully.' };
    },

    // Cancel purchase AND restore stock quantity
    async cancelPurchase(id) {
      // Fetch the purchase first so we know what to restock
      let productName = null;
      let purchaseQty = 1;
      try {
        const rows = await api(`Purchases?ID=eq.${encodeURIComponent(id)}`);
        if (rows && rows.length > 0) {
          productName = rows[0].Product;
          purchaseQty = Number(rows[0].Qty || 1);
        }
      } catch (_) {}

      // Delete the purchase
      await api(`Purchases?ID=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });

      // Restore stock quantity
      if (productName) {
        try {
          const stockRows = await api(`Stock?Product=eq.${encodeURIComponent(productName)}`);
          if (stockRows && stockRows.length > 0) {
            const newQty = Number(stockRows[0].Qty || 0) + purchaseQty;
            await api(`Stock?ID=eq.${encodeURIComponent(stockRows[0].ID)}`, {
              method: 'PATCH',
              body: JSON.stringify({ Qty: newQty })
            });
          }
        } catch (_) {}
      }

      return { success: true, message: 'Purchase canceled and stock restored.' };
    },

    async cancelPayment(id) {
      await api(`payments?ID=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return { success: true, message: 'Payment canceled successfully.' };
    },

    async updateStudentRecord(adNo, name, className, photoUrl) {
      await api(`Students?AdNo=eq.${encodeURIComponent(adNo)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          Name: name,
          Class: className,
          PhotoUrl: photoUrl || ''
        })
      });
      return { success: true, message: 'Student updated successfully.' };
    },

    async deleteStudent(adNo) {
      const cleanAdNo = String(adNo || '').trim();
      const students = await api(`Students?AdNo=eq.${encodeURIComponent(cleanAdNo)}`);
      if (students && students.length > 0) {
        const s = students[0];
        try {
          await api('Deleted students', {
            method: 'POST',
            body: JSON.stringify([{
              AdNo: s.AdNo,
              Name: s.Name,
              DeletedAt: new Date().toISOString()
            }])
          });
        } catch (_) {}
      }
      await api(`Students?AdNo=eq.${encodeURIComponent(cleanAdNo)}`, { method: 'DELETE' });
      return { success: true, message: 'Student deleted successfully.' };
    },

    async addExpenses(expenses) {
      const rows = expenses.map(e => ({
        ID: 'EXP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        Description: e.description,
        Amount: Number(e.amount || 0),
        Date: e.date || new Date().toISOString().split('T')[0],
        CreatedAt: new Date().toISOString()
      }));
      await api('Expense', { method: 'POST', body: JSON.stringify(rows) });
      return { success: true, message: 'Expenses saved successfully.' };
    },

    async addExpense(desc, amount, date) {
      return this.addExpenses([{ description: desc, amount, date }]);
    },

    async deleteExpense(id) {
      await api(`Expense?ID=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      return { success: true, message: 'Expense deleted successfully.' };
    },

    async updateExpense(id, desc, amount, date) {
      await api(`Expense?ID=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ Description: desc, Amount: Number(amount || 0), Date: date })
      });
      return { success: true, message: 'Expense updated successfully.' };
    },

    async getReportData(type, period, from, to) {
      // Fetch all base data
      const purchases = await api('Purchases?select=*') || [];
      const payments  = await api('payments?select=*')  || [];

      // ── Students Due Report ──────────────────────────────────────────────
      if (type === 'Students') {
        const classFilter = String(period || '').trim();
        let students = await api('Students?select=AdNo,Name,Class&order=AdNo.asc') || [];
        if (classFilter) {
          students = students.filter(s => String(s.Class).trim() === classFilter);
        }

        const data = [];
        let slNo = 1;
        for (const s of students) {
          const adNo = String(s.AdNo);
          const due  = purchases
            .filter(p => p.BuyerType === 'Student' && String(p.Identifier) === adNo)
            .reduce((sum, p) => sum + (Number(p.Price || 0) * Number(p.Qty || 1)), 0);
          const paid = payments
            .filter(p => p.PayerType === 'Student' && String(p.Identifier) === adNo)
            .reduce((sum, p) => sum + Number(p.Amount || 0), 0);
          const balance = due - paid;
          if (balance !== 0) {
            data.push({ slNo: slNo++, adNo: s.AdNo, name: s.Name, balance });
          }
        }

        return {
          success: true,
          title: 'Students Due Report',
          headers: ['Sl.No', 'Ad.No', 'Name', 'Balance (₹)'],
          data
        };
      }

      // ── Unions Due Report ────────────────────────────────────────────────
      if (type === 'Union') {
        const unions = await api('unions?select=Name,Class&order=Name.asc') || [];

        const data = [];
        let slNo = 1;
        for (const u of unions) {
          const name = String(u.Name || '').trim();
          const due  = purchases
            .filter(p => p.BuyerType === 'Union' && String(p.Identifier).trim() === name)
            .reduce((sum, p) => sum + (Number(p.Price || 0) * Number(p.Qty || 1)), 0);
          const paid = payments
            .filter(p => p.PayerType === 'Union' && String(p.Identifier).trim() === name)
            .reduce((sum, p) => sum + Number(p.Amount || 0), 0);
          const balance = due - paid;
          if (balance !== 0) {
            data.push({ slNo: slNo++, name, balance });
          }
        }

        return {
          success: true,
          title: 'Unions Due Report',
          headers: ['Sl.No', 'Union Name', 'Balance (₹)'],
          data
        };
      }

      // ── Financial Status Summary (Status / default) ──────────────────────
      const expenses = await api('Expense?select=*&order=Date.desc') || [];
      const fromDate = from || '2000-01-01';
      const toDate   = to   || '2099-12-31';

      const filteredPurchases = purchases.filter(p => !p.Date || (p.Date >= fromDate && p.Date <= toDate));
      const filteredPayments  = payments.filter(p  => !p.Date || (p.Date >= fromDate && p.Date <= toDate));

      const totalPurchasedAmount = filteredPurchases.reduce((s, p) => s + (Number(p.Price || 0) * Number(p.Qty || 1)), 0);
      const totalPaidAmount      = filteredPayments.reduce((s,  p) => s + Number(p.Amount || 0), 0);
      const balance              = totalPurchasedAmount - totalPaidAmount;

      return {
        success: true,
        title: 'FINANCIAL STATUS SUMMARY REPORT',
        fromDate: from,
        toDate: to,
        income: totalPurchasedAmount,
        totalPurchasedAmount,
        totalPaidAmount,
        balance,
        allExpenses: expenses.map(e => ({
          id: e.ID,
          description: e.Description,
          amount: e.Amount,
          date: e.Date
        }))
      };
    },

    async bulkImportData(type, rows) {
      if (type === 'Stock') {
        const inserts = rows.map((r, i) => ({
          ID: r[0] || ('STK_' + Date.now() + '_' + i),
          Product: r[1],
          Qty: Number(r[2] || 0),
          Price: Number(r[3] || 0)
        })).filter(x => x.Product);
        await api('Stock', { method: 'POST', body: JSON.stringify(inserts) });
      } else if (type === 'Students') {
        const inserts = rows.map(r => ({
          AdNo: String(r[0]),
          Name: r[1],
          Class: r[2],
          PhotoUrl: r[3] || ''
        })).filter(x => x.AdNo && x.Name);
        await api('Students', { method: 'POST', body: JSON.stringify(inserts) });
      }
      return { success: true, message: 'Data imported successfully.' };
    }
  };

  /**
   * google.script.run emulator
   */
  class ScriptRunProxy {
    constructor(successCb = null, failureCb = null) {
      this._successCb = successCb;
      this._failureCb = failureCb;

      return new Proxy(this, {
        get: (target, prop) => {
          if (prop === 'withSuccessHandler') {
            return (cb) => new ScriptRunProxy(cb, target._failureCb);
          }
          if (prop === 'withFailureHandler') {
            return (cb) => new ScriptRunProxy(target._successCb, cb);
          }
          if (typeof handlers[prop] === 'function') {
            return async (...args) => {
              try {
                const res = await handlers[prop](...args);
                if (target._successCb) target._successCb(res);
                return res;
              } catch (err) {
                console.error(`[Supabase Error in ${prop}]:`, err);
                if (target._failureCb) target._failureCb(err);
                else if (typeof window.appMessage === 'function') {
                  window.appMessage(err.message, 'danger');
                }
                throw err;
              }
            };
          }
          return (...args) => {
            console.warn(`Unimplemented method: ${prop}`, args);
          };
        }
      });
    }
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = new ScriptRunProxy();

  console.log('✅ Supabase adapter v3 initialized — cancelPurchase restocks inventory');
})();
