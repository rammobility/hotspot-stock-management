import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../utils/firebase';
import StockHeader from './StockHeader';

interface Category {
  categoryId: string;
  categoryName: string;
}

interface StockItem {
  id: string;
  categoryName: string;
  data: {
    itemName: string;
    unit: string;
  };
}

interface ConsumptionData {
  date: string;
  itemName: string;
  categoryName: string;
  openingStock: number;
  purchases: number;
  closingStock: number;
  consumption: number;
  unit: string;
}

const StockReport = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [consumptionData, setConsumptionData] = useState<ConsumptionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const categoriesRef = collection(db, 'masterStock');
        const categoriesSnap = await getDocs(categoriesRef);
        const categoriesList: Category[] = [];

        categoriesSnap.forEach((doc) => {
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

  // Fetch all items from all categories
  useEffect(() => {
    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const itemsList: StockItem[] = [];

        if (selectedCategory) {
          // Fetch items for selected category only
          const itemsRef = collection(db, `masterStock/${selectedCategory}/items`);
          const itemsSnap = await getDocs(itemsRef);

          itemsSnap.forEach((doc) => {
            const data = doc.data();
            itemsList.push({
              id: doc.id,
              categoryName: selectedCategory,
              data: {
                itemName: data.data.itemName,
                unit: data.data.unit
              }
            });
          });
        } else {
          // Fetch items from all categories
          for (const category of categories) {
            const itemsRef = collection(db, `masterStock/${category.categoryName}/items`);
            const itemsSnap = await getDocs(itemsRef);

            itemsSnap.forEach((doc) => {
              const data = doc.data();
              itemsList.push({
                id: doc.id,
                categoryName: category.categoryName,
                data: {
                  itemName: data.data.itemName,
                  unit: data.data.unit
                }
              });
            });
          }
        }

        console.log('Fetched items:', itemsList);
        setItems(itemsList.sort((a, b) => a.data.itemName.localeCompare(b.data.itemName)));
      } catch (error) {
        console.error('Error fetching items:', error);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, [selectedCategory, categories]);

  const fetchConsumptionData = async () => {
    if (!startDate && !endDate && !selectedCategory && !selectedItem) {
      alert('Please select at least one filter');
      return;
    }

    setLoading(true);
    setConsumptionData([]); // Clear previous data
    
    try {
      console.log('Fetching data with filters:', {
        startDate,
        endDate,
        selectedCategory,
        selectedItem
      });

      // Create base query
      const dailyStockRef = collection(db, 'dailyStock');
      let constraints: any[] = [orderBy('date', 'asc')];

      // Execute query to get all documents in date range
      const q = query(dailyStockRef, ...constraints);
      const querySnapshot = await getDocs(q);
      
      console.log('Raw documents:', querySnapshot.docs.map(doc => ({
        id: doc.id,
        date: doc.data().date,
        entries: doc.data().entries
      })));

      // Filter documents by date range in memory
      const filteredDocs = querySnapshot.docs.filter(doc => {
        const docDate = doc.data().date;
        console.log('Checking date:', docDate, 'against range:', startDate, 'to', endDate);
        const inRange = (!startDate || docDate >= startDate) && (!endDate || docDate <= endDate);
        console.log('In range?', inRange);
        return inRange;
      });

      console.log('Found documents:', filteredDocs.length);
      
      const consumptionList: ConsumptionData[] = [];
      let previousDayStock: { [key: string]: number } = {};

      filteredDocs.forEach((doc) => {
        const data = doc.data();
        const entries = data.entries;

        console.log('Processing entries:', entries);
        Object.entries(entries).forEach(([itemName, entry]: [string, any]) => {
          console.log('Processing item:', itemName, 'Entry:', entry);
          // Filter by category and item if selected
          const item = items.find(i => i.data.itemName === itemName);
          console.log('Found matching item:', item);
          if (
            (selectedCategory && item?.categoryName !== selectedCategory) ||
            (selectedItem && itemName !== selectedItem)
          ) {
            console.log('Skipping item due to filters:', {
              itemName,
              selectedCategory,
              itemCategory: item?.categoryName,
              selectedItem
            });
            return;
          }

          const openingStock = previousDayStock[itemName] || 0; // Start with 0 if no previous day
          const purchases = entry.purchaseQty || 0;
          const closingStock = entry.closingQty || 0;
          const consumption = (openingStock + purchases) - closingStock;

          console.log(`Date: ${data.date}, Item: ${itemName}`);
          console.log(`Opening: ${openingStock}, Purchases: ${purchases}, Closing: ${closingStock}`);
          console.log(`Consumption: ${consumption}`);

          if (item) {
            consumptionList.push({
              date: data.date,
              itemName,
              categoryName: item.categoryName,
              openingStock,
              purchases,
              closingStock,
              consumption,
              unit: item.data.unit
            });
          }

          // Store closing stock for next day's opening stock
          previousDayStock[itemName] = closingStock;
        });
      });

      console.log('Processed consumption data:', consumptionList);
      setConsumptionData(consumptionList);
    } catch (error) {
      console.error('Error fetching consumption data:', error);
      alert('Error fetching data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StockHeader title="Stock Consumption Report" />
      <div className="container" style={{ marginTop: '80px' }}>
        <div className="row justify-content-center">
          <div className="col-md-10">
            <div className="card">
            <div className="card-body">
              {/* Filters */}
              <div className="row g-3 mb-4">
                <div className="col-md-3">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Category</label>
                  <div className="position-relative">
                    <select
                      className="form-select"
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setSelectedItem('');
                      }}
                      disabled={loadingCategories}
                    >
                      <option value="">All Categories</option>
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
                <div className="col-md-3">
                  <label className="form-label">Item</label>
                  <div className="position-relative">
                    <select
                      className="form-select"
                      value={selectedItem}
                      onChange={(e) => setSelectedItem(e.target.value)}
                      disabled={!selectedCategory || loadingItems}
                    >
                      <option value="">All Items</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.data.itemName}>
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
              </div>

              {/* Search Button */}
              <div className="text-center mb-4">
                <button 
                  className="btn btn-primary"
                  onClick={fetchConsumptionData}
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Generate Report'}
                </button>
              </div>

              {/* Results Grid */}
              <div>
                {loading ? (
                  <div className="text-center my-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 text-muted">Generating report...</p>
                  </div>
                ) : (
                  <>
                    <p className="text-muted mb-2">
                      Found {consumptionData.length} records
                    </p>
                    {consumptionData.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-striped table-bordered">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Item</th>
                          <th>Consumption</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consumptionData.map((item, index) => (
                          <tr key={`${item.date}-${item.itemName}-${index}`}>
                            <td>{new Date(item.date).toLocaleDateString()}</td>
                            <td>{item.itemName}</td>
                            <td>{item.consumption} {item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-muted">
                    No data found for the selected criteria
                  </div>
                )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default StockReport;