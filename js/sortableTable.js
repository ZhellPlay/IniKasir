window.SortableTable = {
    state: {
        transactions: { field: 'date', direction: 'desc' },
        menus: { field: 'name', direction: 'asc' },
        bahan: { field: 'name', direction: 'asc' },
        kasir: { field: 'nama', direction: 'asc' },
        meja: { field: 'nomor', direction: 'asc' }
    },
    sort(array, configKey, customSortFn) {
        const config = this.state[configKey];
        if (!config) return array;
        return [...array].sort((a, b) => {
            let valA = this._getValue(a, config.field);
            let valB = this._getValue(b, config.field);
            if (customSortFn) {
                return customSortFn(valA, valB, config.direction);
            }
            if (typeof valA === 'number' && typeof valB === 'number') {
                return config.direction === 'asc' ? valA - valB : valB - valA;
            }
            if (valA instanceof Date || (valA?.seconds)) {
                valA = valA?.seconds ? new Date(valA.seconds * 1000) : new Date(valA);
                valB = valB?.seconds ? new Date(valB.seconds * 1000) : new Date(valB);
                return config.direction === 'asc' ? valA - valB : valB - valA;
            }
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
            if (config.direction === 'asc') {
                return valA.localeCompare(valB);
            } else {
                return valB.localeCompare(valA);
            }
        });
    },
    _getValue(obj, field) {
        if (field.includes('.')) {
            return field.split('.').reduce((o, k) => o?.[k], obj);
        }
        return obj?.[field];
    },
    toggle(configKey, field) {
        const config = this.state[configKey];
        if (config.field === field) {
            config.direction = config.direction === 'asc' ? 'desc' : 'asc';
        } else {
            config.field = field;
            config.direction = 'asc';
        }
    },
    getSortIcon(configKey, field) {
        const config = this.state[configKey];
        if (config.field !== field) return 'fa-sort';
        return config.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
    }
};