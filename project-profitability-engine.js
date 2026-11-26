/* CSK project profitability engine.
 * Read-only analysis of contract value, saved HPP, legacy recorded project costs,
 * and verified Invoice payment records. It never writes or mutates source data.
 */
(function(root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CSKProjectProfitabilityEngine = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function() {
  'use strict';

  function text(value) {
    return String(value === undefined || value === null ? '' : value).trim();
  }

  function money(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0;
    var raw = text(value).replace(/[^0-9,.-]/g, '');
    if (!raw) return 0;
    if (raw.indexOf(',') >= 0 && raw.indexOf('.') >= 0) {
      raw = raw.lastIndexOf(',') > raw.lastIndexOf('.')
        ? raw.replace(/\./g, '').replace(',', '.')
        : raw.replace(/,/g, '');
    } else if (raw.indexOf(',') >= 0) {
      var commaParts = raw.split(',');
      raw = commaParts.length > 2 || commaParts[commaParts.length - 1].length === 3
        ? raw.replace(/,/g, '')
        : raw.replace(',', '.');
    } else if (raw.indexOf('.') >= 0) {
      var dotParts = raw.split('.');
      raw = dotParts.length > 2 || dotParts[dotParts.length - 1].length === 3
        ? raw.replace(/\./g, '')
        : raw;
    }
    var parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  function dateOrder(row) {
    return text(row && (row.updatedAt || row.createdAt || row.date || row.orderDate));
  }

  function isCancelled(row) {
    var status = text(row && row.status).toLowerCase();
    return ['cancelled', 'canceled', 'batal', 'void', 'draft'].indexOf(status) >= 0;
  }

  function latestHpp(projectId, rows) {
    var candidates = (Array.isArray(rows) ? rows : []).filter(function(row) {
      return row && text(row.projectId) === projectId;
    });
    if (!candidates.length) return null;
    candidates.sort(function(a, b) {
      return dateOrder(a).localeCompare(dateOrder(b));
    });
    var row = candidates[candidates.length - 1];
    var materialTotal = money(row.materialTotal);
    var labor = money(row.labor);
    var other = money(row.other);
    var total = money(row.total);
    if (total <= 0) total = materialTotal + labor + other;
    if (total <= 0 && materialTotal <= 0 && labor <= 0 && other <= 0) return null;
    return {
      id: text(row.id),
      updatedAt: dateOrder(row),
      materialTotal: materialTotal,
      labor: labor,
      other: other,
      total: total
    };
  }

  function activeSalesOrders(projectId, rows) {
    var byQuotation = Object.create(null);
    var duplicateCount = 0;
    (Array.isArray(rows) ? rows : []).filter(function(row) {
      return row && text(row.projectId) === projectId && !isCancelled(row);
    }).sort(function(a, b) {
      return dateOrder(a).localeCompare(dateOrder(b));
    }).forEach(function(row) {
      var key = text(row.quotationId) || text(row.id);
      if (byQuotation[key]) duplicateCount++;
      byQuotation[key] = row;
    });
    return { rows: Object.keys(byQuotation).map(function(key) { return byQuotation[key]; }), duplicateCount: duplicateCount };
  }

  function recordedCosts(projectId, rows) {
    var seen = Object.create(null);
    var categories = Object.create(null);
    var total = 0;
    var count = 0;
    var invalid = 0;
    (Array.isArray(rows) ? rows : []).forEach(function(row, index) {
      if (!row || text(row.projectId) !== projectId) return;
      var id = text(row.id) || [
        projectId, text(row.date), text(row.category), text(row.description), money(row.amount)
      ].join('|');
      if (seen[id]) return;
      seen[id] = true;
      var amount = money(row.amount);
      if (amount <= 0) amount = money(row.qty) * money(row.unitPrice);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        invalid++;
        return;
      }
      var category = text(row.category) || 'Tidak dikategorikan';
      categories[category] = (categories[category] || 0) + amount;
      total += amount;
      count++;
    });
    return {
      total: total,
      count: count,
      invalidCount: invalid,
      categories: Object.keys(categories).sort().map(function(category) {
        return { category: category, amount: categories[category] };
      })
    };
  }

  function projectCashReceived(projectId, invoices, payments) {
    var invoiceIds = Object.create(null);
    (Array.isArray(invoices) ? invoices : []).forEach(function(invoice) {
      if (invoice && text(invoice.projectId) === projectId && !isCancelled(invoice)) {
        invoiceIds[text(invoice.id)] = true;
      }
    });
    var seen = Object.create(null);
    return (Array.isArray(payments) ? payments : []).reduce(function(total, payment) {
      var id = text(payment && payment.id);
      if (!payment || !invoiceIds[text(payment.invoiceId)] || (id && seen[id])) return total;
      if (id) seen[id] = true;
      return total + Math.max(0, money(payment.amount));
    }, 0);
  }

  function calculateProject(project, data) {
    data = data || {};
    var projectId = text(project && project.id);
    var orders = activeSalesOrders(projectId, data.salesOrders);
    var orderRevenue = orders.rows.reduce(function(total, row) {
      return total + Math.max(0, money(row.total));
    }, 0);
    var projectValue = Math.max(0, money(project && project.value));
    var revenueSource = orderRevenue > 0 ? 'sales_orders' : (projectValue > 0 ? 'project_value' : 'none');
    var contractValue = orderRevenue > 0 ? orderRevenue : projectValue;
    var hpp = latestHpp(projectId, data.costSheets);
    var costs = recordedCosts(projectId, data.projectCosts);
    var cashReceived = projectCashReceived(projectId, data.invoices, data.invoicePayments);
    var estimatedProfit = hpp && contractValue > 0 ? contractValue - hpp.total : null;
    var recordedProfit = costs.count > 0 && contractValue > 0 ? contractValue - costs.total : null;
    var warnings = [];
    if (revenueSource === 'project_value') warnings.push('Nilai kontrak belum berasal dari Sales Order; menggunakan nilai proyek sebagai fallback.');
    if (revenueSource === 'none') warnings.push('Nilai kontrak belum tersedia.');
    if (!hpp) warnings.push('HPP tersimpan belum tersedia.');
    if (!costs.count) warnings.push('Belum ada biaya aktual yang tercatat pada arsip Project_Costs.');
    if (hpp && hpp.materialTotal > 0) warnings.push('Biaya material aktual belum dinilai dari ledger inventory; laba berdasarkan biaya tercatat belum final.');
    if (orders.duplicateCount) warnings.push('Ada Sales Order ganda untuk quotation yang sama; periksa data sumber.');

    return {
      projectId: projectId,
      projectName: text(project && project.title) || 'Proyek tanpa nama',
      client: text(project && project.client),
      status: text(project && project.status),
      contractValue: contractValue,
      revenueSource: revenueSource,
      salesOrderCount: orders.rows.length,
      duplicateSalesOrderCount: orders.duplicateCount,
      hpp: hpp,
      recordedCost: costs.total,
      recordedCostCount: costs.count,
      invalidCostCount: costs.invalidCount,
      costCategories: costs.categories,
      cashReceived: cashReceived,
      estimatedProfit: estimatedProfit,
      estimatedMarginPct: estimatedProfit === null ? null : (contractValue > 0 ? estimatedProfit / contractValue * 100 : null),
      recordedProfit: recordedProfit,
      recordedMarginPct: recordedProfit === null ? null : (contractValue > 0 ? recordedProfit / contractValue * 100 : null),
      recordedCostVsHpp: hpp && costs.count ? costs.total - hpp.total : null,
      warnings: warnings,
      isIndicative: true
    };
  }

  function calculatePortfolio(data) {
    data = data || {};
    var projects = (Array.isArray(data.projects) ? data.projects : []).map(function(project) {
      return calculateProject(project, data);
    });
    var withHpp = projects.filter(function(row) { return !!row.hpp; });
    var withCosts = projects.filter(function(row) { return row.recordedCostCount > 0; });
    var withRevenue = projects.filter(function(row) { return row.contractValue > 0; });
    return {
      projects: projects,
      totals: {
        projectCount: projects.length,
        projectsWithHpp: withHpp.length,
        projectsWithRecordedCosts: withCosts.length,
        contractValue: projects.reduce(function(sum, row) { return sum + row.contractValue; }, 0),
        estimatedHpp: withHpp.reduce(function(sum, row) { return sum + row.hpp.total; }, 0),
        recordedCosts: projects.reduce(function(sum, row) { return sum + row.recordedCost; }, 0),
        estimatedProfit: projects.reduce(function(sum, row) { return sum + (row.estimatedProfit === null ? 0 : row.estimatedProfit); }, 0),
        recordedProfit: withRevenue.reduce(function(sum, row) { return sum + (row.recordedProfit === null ? 0 : row.recordedProfit); }, 0),
        cashReceived: projects.reduce(function(sum, row) { return sum + row.cashReceived; }, 0)
      },
      notes: [
        'Laba estimasi menggunakan nilai kontrak dikurangi HPP tersimpan.',
        'Laba berdasarkan biaya tercatat hanya indikatif dan bukan laba final.',
        'Arsip Project_Costs bersifat read-only; biaya yang belum dicatat tidak otomatis terhitung.',
        'Biaya material aktual belum dinilai dari transaksi inventory sehingga belum dapat dipastikan tanpa valuasi persediaan.'
      ]
    };
  }

  return {
    money: money,
    latestHpp: latestHpp,
    calculateProject: calculateProject,
    calculatePortfolio: calculatePortfolio
  };
});
