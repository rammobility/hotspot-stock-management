import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import { db } from '../../utils/firebase';
import { testFirebaseConnection } from '../../utils/testFirebase';
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

const AddStock = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        // Test Firebase connection first
        console.log('Testing Firebase connection...');
        const testResult = await testFirebaseConnection();
        console.log('Test result:', testResult);
        
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
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: (error as any)?.code,
          stack: error instanceof Error ? error.stack : null
        });
        
        if (error instanceof Error) {
          if (error.message.includes('CORS')) {
            alert('CORS Error: Please check your Firebase configuration and make sure you have the correct permissions.');
          } else if (error.message.includes('permission-denied')) {
            alert('Permission denied: Please check your Firestore security rules.');
          } else if (error.message.includes('not-found')) {
            alert('Database not found: Please check your Firebase project configuration.');
          } else {
            alert(`Error loading categories: ${error.message}`);
          }
        } else {
          alert('Unknown error loading categories. Check console for details.');
        }
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
      }
    };

    fetchItems();
  }, [selectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !quantity || !currentStock || !pricePerUnit) {
      alert('All fields are required');
      return;
    }

    setLoading(true);
    try {
      const item = items.find(i => i.id === selectedItem);
      if (!item) return;

      // Add purchase record
      await addDoc(collection(db, 'purchases'), {
        itemId: selectedItem,
        itemName: item.data.itemName,
        quantity: Number(quantity),
        stockBeforePurchase: Number(currentStock),
        pricePerUnit: Number(pricePerUnit),
        totalAmount: Number(pricePerUnit) * Number(quantity),
        date: new Date(selectedDate),
        type: 'purchase'
      });

      // Update master record
      const itemRef = doc(db, `masterStock/${selectedCategory}/items/${selectedItem}`);
      const newCurrentStock = Number(currentStock) + Number(quantity);
      await updateDoc(itemRef, {
        currentStock: newCurrentStock,
        lastPurchaseDate: new Date(selectedDate),
        lastPurchaseQuantity: Number(quantity),
        consumption: item.lastPurchaseDate 
          ? (item.lastPurchaseQuantity || 0) - Number(currentStock)
          : 0
      });

      // Update or create daily stock record
      const dailyStockRef = doc(db, 'dailyStock', selectedDate);
      const dailyStockDoc = await getDoc(dailyStockRef);
      
      if (dailyStockDoc.exists()) {
        // Update existing daily stock record
        await updateDoc(dailyStockRef, {
          [`entries.${item.data.itemName}.purchaseQty`]: Number(quantity),
          [`entries.${item.data.itemName}.closingQty`]: newCurrentStock
        });
      } else {
        // Create new daily stock record
        await setDoc(dailyStockRef, {
          date: selectedDate,
          entries: {
            [item.data.itemName]: {
              purchaseQty: Number(quantity),
              closingQty: newCurrentStock
            }
          }
        });
      }

      navigate('/');
    } catch (error) {
      console.error('Error adding purchase:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StockHeader title="Add Stock" />
      <div className="container" style={{ marginTop: '80px' }}>
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="category" className="form-label">Select Category *</label>
                  <select
                    id="category"
                    className="form-select"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedItem('');
                      setCurrentStock('');
                    }}
                    required
                  >
                    <option value="">Choose category...</option>
                    {categories.map((category) => (
                      <option key={category.categoryId} value={category.categoryName}>
                        {category.categoryName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label htmlFor="item" className="form-label">Select Item *</label>
                  <select
                    id="item"
                    className="form-select"
                    value={selectedItem}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      setSelectedItem(selectedValue);
                      const item = items.find(i => i.id === selectedValue);
                      console.log('Selected item:', item); // Debug log
                      console.log('Unit value:', item?.data?.unit); // Debug unit value
                      
                      if (item) {
                        setCurrentStock(item.currentStock?.toString() || '0');
                        setSelectedUnit(item.data.unit);
                      } else {
                        setCurrentStock('0');
                        setSelectedUnit('');
                      }
                    }}
                    required
                    disabled={!selectedCategory}
                  >
                    <option value="">Choose item...</option>
                    {items.map((item) => (
                      <option key={`${item.data.categoryId}-${item.id}`} value={item.id}>
                        {item.data.itemName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label htmlFor="currentStock" className="form-label">Current Stock</label>
                  <div className="input-group">
                    <input
                      type="number"
                      className="form-control"
                      id="currentStock"
                      value={currentStock}
                      readOnly
                      disabled
                    />
                    <span className="input-group-text">
                      {selectedUnit || 'Units'}
                    </span>
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="quantity" className="form-label">Purchase Quantity *</label>
                  <div className="input-group">
                    <input
                      type="number"
                      className="form-control"
                      id="quantity"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      required
                    />
                    <span className="input-group-text">
                      {selectedUnit || 'Units'}
                    </span>
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="pricePerUnit" className="form-label">Price Per Unit *</label>
                  <div className="input-group">
                    <span className="input-group-text">₹</span>
                    <input
                      type="number"
                      className="form-control"
                      id="pricePerUnit"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(e.target.value)}
                      step="0.01"
                      min="0"
                      required
                    />
                    <span className="input-group-text">per {selectedUnit || 'Unit'}</span>
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="purchaseDate" className="form-label">Purchase Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    id="purchaseDate"
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
                    {loading ? 'Saving...' : 'Add Purchase'}
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

export default AddStock;