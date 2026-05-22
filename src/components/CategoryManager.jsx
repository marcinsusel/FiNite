import React, { useState } from 'react';
import { Tag, Plus, Trash2, Lock, X, Zap } from 'lucide-react';

export default function CategoryManager({ 
  categories, 
  transactions, 
  onAddCategory, 
  onDeleteCategory,
  onUpdateCategory,
  onApplyAutoCategorize
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const trimmed = name.trim();
    if (!trimmed) return;

    // Check case-insensitive duplicates
    const duplicate = categories.find(
      c => c.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (duplicate) {
      setError(`A category named "${duplicate.name}" already exists.`);
      return;
    }

    const newId = `custom_${Math.random().toString(36).substr(2, 9)}`;
    onAddCategory({
      id: newId,
      name: trimmed,
      keywords: []
    });
    setName('');
  };

  const handleDelete = (cat) => {
    setError('');
    // Count transactions using this category
    const usageCount = transactions.reduce((count, tx) => {
      const uses = tx.splits.some(s => s.categoryId === cat.id);
      return count + (uses ? 1 : 0);
    }, 0);

    if (usageCount > 0) {
      alert(`Cannot delete category "${cat.name}". It is currently used by ${usageCount} transaction(s). Please edit those transactions to assign a different category first.`);
      return;
    }

    if (window.confirm(`Are you sure you want to delete the custom category "${cat.name}"?`)) {
      onDeleteCategory(cat.id);
    }
  };

  const handleAddKeyword = (cat, val) => {
    const trimmed = val.trim();
    if (!trimmed) return;

    const currentKeywords = cat.keywords || [];
    // Prevent duplicate keywords within the same category (case-insensitive check)
    const exists = currentKeywords.some(k => k.toLowerCase() === trimmed.toLowerCase());
    if (exists) return;

    const updatedKeywords = [...currentKeywords, trimmed];
    onUpdateCategory({
      ...cat,
      keywords: updatedKeywords
    });
  };

  const handleRemoveKeyword = (cat, keywordToRemove) => {
    const currentKeywords = cat.keywords || [];
    const updatedKeywords = currentKeywords.filter(k => k !== keywordToRemove);
    onUpdateCategory({
      ...cat,
      keywords: updatedKeywords
    });
  };

  return (
    <div className="grid-cols-2 fade-in">
      {/* Category Creation Form */}
      <div className="card" style={{ height: 'fit-content' }}>
        <h2 className="card-title">
          <Plus size={20} className="text-primary" />
          Add Category
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="catName">Category Name</label>
            <input 
              id="catName"
              type="text" 
              className="input" 
              placeholder="e.g. Hobbies, Gifts, Investments" 
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              required
            />
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}>
            <Tag size={16} />
            Create Category
          </button>
        </form>
      </div>

      {/* Category List */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            <Tag size={20} className="text-primary" />
            Categories ({categories.length})
          </h2>
          {onApplyAutoCategorize && (
            <button 
              onClick={() => {
                const count = onApplyAutoCategorize();
                alert(`Auto-categorization completed! Updated ${count} transaction(s).`);
              }}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', borderColor: 'rgba(34,197,94,0.3)' }}
              title="Scan all unreviewed transactions and auto-categorize splits matching keywords"
            >
              <Zap size={14} className="text-success" />
              <span>Apply Rules</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
          {categories.map(cat => {
            const isBuiltIn = cat.id.startsWith('cat-');
            return (
              <div 
                key={cat.id} 
                className="compare-card" 
                style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '1rem' }}
              >
                {/* Category Card Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: isBuiltIn ? 'rgba(255, 255, 255, 0.03)' : 'rgba(99, 102, 241, 0.08)' }}>
                      <Tag size={18} className={isBuiltIn ? "text-muted" : "text-primary"} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{cat.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {isBuiltIn ? 'Built-in Category' : 'Custom Category'}
                      </div>
                    </div>
                  </div>

                  {isBuiltIn ? (
                    <div style={{ color: 'var(--text-muted)', padding: '6px' }} title="Default category cannot be deleted">
                      <Lock size={16} style={{ opacity: 0.5 }} />
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleDelete(cat)} 
                      className="btn btn-secondary btn-sm" 
                      style={{ color: 'var(--danger)', padding: '6px', minHeight: 'auto' }}
                      title="Delete Category"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Keywords Editor Section */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Auto-Categorization Keywords:
                  </label>
                  
                  {/* Keywords Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {(cat.keywords || []).map((keyword, kwIdx) => (
                      <span 
                        key={kwIdx} 
                        style={{ 
                          fontSize: '0.75rem', 
                          padding: '3px 8px', 
                          borderRadius: '12px', 
                          backgroundColor: 'rgba(99, 102, 241, 0.12)', 
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          color: 'var(--primary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {keyword}
                        <X 
                          size={10} 
                          style={{ cursor: 'pointer', opacity: 0.7 }} 
                          onClick={() => handleRemoveKeyword(cat, keyword)}
                          title="Remove keyword"
                        />
                      </span>
                    ))}
                    {(cat.keywords || []).length === 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No keywords configured.
                      </span>
                    )}
                  </div>

                  {/* Add Keyword Input Inline */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ fontSize: '0.75rem', padding: '4px 8px', height: '28px' }} 
                      placeholder="Add keyword (e.g. Netflix, Kroger) + Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddKeyword(cat, e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
