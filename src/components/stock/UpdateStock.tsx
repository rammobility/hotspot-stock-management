import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../utils/firebase';
import StockHeader from './StockHeader';

interface Category {
  categoryId: string;
  categoryName: string;
}

interface StockItem {
  id: string;
  data: {
    categoryId: string;
    itemName: string;
    maxStock: number;
    minStock: number;
    unit: string;
  };
  currentStock?: number;
  lastPurchaseDate?: Date;
  lastPurchaseQuantity?: number;
}

const UpdateStock = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const categoriesRef = collection(db, 'masterStock');
        const categoriesSnapshot = await getDocs(categoriesRef);
        const categoriesList: Category[] = [];

        categoriesSnapshot.forEach((doc) => {
          const data = doc.data();
          categoriesList.push({
            categoryId: data.categoryId,
            categoryName: doc.id
          });
        });

        setCategories(categoriesList.sort((a, b) => a.categoryName.localeCompare(b.categoryName)));
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchItems = async () => {
      if (!selectedCategory) {
        setItems([]);
        return;
      }

      setLoadingItems(true);
      try {
        const itemsRef = collection(db, `masterStock/${selectedCategory}/items`);
        const itemsSnapshot = await getDocs(itemsRef);
        const itemsList: StockItem[] = [];

        itemsSnapshot.forEach((doc) => {
          const docData = doc.data();
          console.log('Document ID:', doc.id);
          console.log('Document data:', docData);
          console.log('Unit from docData:', docData.data?.unit);
          
          itemsList.push({
            id: doc.id,
            data: {
              categoryId: docData.data.categoryId,
              itemName: docData.data.itemName,
              maxStock: docData.data.maxStock,
              minStock: docData.data.minStock,
              unit: docData.data.unit
            },
            currentStock: docData.currentStock || 0,
            lastPurchaseDate: docData.lastPurchaseDate?.toDate(),
            lastPurchaseQuantity: docData.lastPurchaseQuantity
          });
        });

        setItems(itemsList.sort((a, b) => a.id.localeCompare(b.id)));
      } catch (error) {
        console.error('Error fetching items:', error);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, [selectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !selectedItem || !currentStock) {
      alert('All fields are required');
      return;
    }

    setLoading(true);
    try {
      const item = items.find(i => i.id === selectedItem);
      if (!item) return;

      // Add stock update record
      await addDoc(collection(db, 'purchases'), {
        itemId: selectedItem,
        itemName: item.data.itemName,
        currentStock: Number(currentStock),
        previousStock: item.currentStock,
        categoryId: item.data.categoryId,
        unit: item.data.unit,
        date: new Date(selectedDate),
        type: 'update'
      });

      // Update master record
      const itemRef = doc(db, `masterStock/${selectedCategory}/items/${selectedItem}`);
      await updateDoc(itemRef, {
        currentStock: Number(currentStock),
        lastUpdated: new Date(selectedDate)
      });

      // Update or create daily stock record
      const dailyStockRef = doc(db, 'dailyStock', selectedDate);
      const dailyStockDoc = await getDoc(dailyStockRef);
      
      if (dailyStockDoc.exists()) {
        // Update existing daily stock record
        await updateDoc(dailyStockRef, {
          [`entries.${item.data.itemName}.closingQty`]: Number(currentStock)
        });
      } else {
        // Create new daily stock record
        await setDoc(dailyStockRef, {
          date: selectedDate,
          entries: {
            [item.data.itemName]: {
              purchaseQty: 0,
              closingQty: Number(currentStock)
            }
          }
        });
      }

      navigate('/');
    } catch (error) {
      console.error('Error updating stock:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StockHeader title="Update Stock" />
      <div className="container" style={{ marginTop: '80px' }}>
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card">
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="category" className="form-label">Select Category *</label>
                  <div className="position-relative">
                    <select
                      id="category"
                      className="form-select"
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setSelectedItem('');
                        setCurrentStock('');
                        setSelectedUnit('');
                      }}
                      required
                      disabled={loadingCategories}
                    >
                      <option value="">Choose category...</option>
                      {categories.map((category) => (
                        <option key={category.categoryId} value={category.categoryName}>
                          {category.categoryName}
                        </option>
                      ))}
                    </select>
                    {loadingCategories && (
                      <div className="position-absolute top-50 end-0 translate-middle-y pe-3">
                        <div className="spinner-border spinner-border-sm text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="item" className="form-label">Select Item *</label>
                  <div className="position-relative">
                    <select
                      id="item"
                      className="form-select"
                      value={selectedItem}
                      onChange={(e) => {
                        const selectedValue = e.target.value;
                        setSelectedItem(selectedValue);
                        const item = items.find(i => i.id === selectedValue);
                        if (item) {
                          setCurrentStock(item.currentStock?.toString() || '0');
                          setSelectedUnit(item.data.unit);
                        }
                      }}
                      required
                      disabled={!selectedCategory || loadingItems}
                    >
                      <option value="">Choose item...</option>
                      {items.map((item) => (
                        <option key={`${item.data.categoryId}-${item.id}`} value={item.id}>
                          {item.data.itemName}
                        </option>
                      ))}
                    </select>
                    {loadingItems && (
                      <div className="position-absolute top-50 end-0 translate-middle-y pe-3">
                        <div className="spinner-border spinner-border-sm text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="currentStock" className="form-label">Stock Remaining *</label>
                  <div className="input-group">
                    <input
                      type="number"
                      className="form-control"
                      id="currentStock"
                      value={currentStock}
                      onChange={(e) => setCurrentStock(e.target.value)}
                      required
                    />
                    <span className="input-group-text">
                      {selectedUnit || 'Units'}
                    </span>
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="updateDate" className="form-label">Update Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    id="updateDate"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                  />
                </div>

                <div className="d-grid">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Updating...' : 'Update Stock'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default UpdateStock;