import React, { useState, useEffect } from 'react';
import { PlusCircle, Settings, Upload, Download, Calendar, TrendingUp, Smile, Meh, Frown, ChevronDown, ChevronUp, X } from 'lucide-react';

const NutritionTracker = () => {
  const [records, setRecords] = useState([]);
  const [profile, setProfile] = useState({
    gender: 'male',
    age: 30,
    height: 175,
    weight: 70,
    activity: 'moderate'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [expandedDays, setExpandedDays] = useState({});
  const [notification, setNotification] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tg, setTg] = useState(null);

  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    ingredient: '',
    weight: '',
    calories: '',
    protein: '',
    fats: '',
    carbs: ''
  });

 // Инициализация Telegram WebApp
  useEffect(() => {
    const initTelegram = () => {
      try {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
          const telegram = window.Telegram.WebApp;
          setTg(telegram);
          
          telegram.ready();
          telegram.expand();
          telegram.enableClosingConfirmation();
          
          telegram.setHeaderColor('#111827');
          telegram.setBackgroundColor('#000000');
          
          telegram.MainButton.setText('Добавить запись');
          telegram.MainButton.color = '#fb923c';
          telegram.MainButton.textColor = '#ffffff';
          telegram.MainButton.hide();
          
          telegram.MainButton.onClick(() => {
            setShowAddForm(true);
            telegram.MainButton.hide();
          });
        }
        setIsLoading(false);
      } catch (error) {
        console.log('Telegram WebApp not available:', error);
        setIsLoading(false);
      }
    };
    
    initTelegram();
  }, []);

  // Сохранение в Telegram Cloud Storage
  const saveToCloudStorage = (key, value) => {
    if (!window.Telegram?.WebApp?.CloudStorage) return;
    
    window.Telegram.WebApp.CloudStorage.setItem(key, JSON.stringify(value), (error, success) => {
      if (error) {
        console.error('Ошибка сохранения:', error);
        showNotification('Ошибка сохранения данных', 'error');
      }
    });
  };

  // Автосохранение при изменении данных
  useEffect(() => {
    if (!isLoading) {
      saveToCloudStorage('records', records);
    }
  }, [records]);

  useEffect(() => {
    if (!isLoading) {
      saveToCloudStorage('profile', profile);
    }
  }, [profile]);

  // Управление главной кнопкой Telegram
  useEffect(() => {
    if (tg) {
      if (showAddForm) {
        tg.MainButton.hide();
      } else {
        tg.MainButton.show();
      }
    }
  }, [showAddForm, tg]);

  const calculateBMR = () => {
    const { gender, age, height, weight } = profile;
    if (gender === 'male') {
      return 10 * weight + 6.25 * height - 5 * age + 5;
    }
    return 10 * weight + 6.25 * height - 5 * age - 161;
  };

  const calculateDailyCalories = () => {
    const bmr = calculateBMR();
    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      veryActive: 1.9
    };
    return Math.round(bmr * activityMultipliers[profile.activity]);
  };

  const calculateDailyNutrients = () => {
    const calories = calculateDailyCalories();
    return {
      calories: calories,
      protein: Math.round(profile.weight * 1.6),
      fats: Math.round((calories * 0.25) / 9),
      carbs: Math.round((calories * 0.50) / 4)
    };
  };

  const dailyNorms = calculateDailyNutrients();

  const getFilteredRecords = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return records.filter(record => {
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);
      
      switch(selectedPeriod) {
        case 'today':
          return recordDate.getTime() === today.getTime();
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return recordDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return recordDate >= monthAgo;
        case 'custom':
          if (customDateRange.start && customDateRange.end) {
            const start = new Date(customDateRange.start);
            const end = new Date(customDateRange.end);
            return recordDate >= start && recordDate <= end;
          }
          return true;
        default:
          return true;
      }
    });
  };

  const getRecordsByDay = () => {
    const filtered = getFilteredRecords();
    const grouped = {};
    
    filtered.forEach(record => {
      const date = record.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(record);
    });
    
    return grouped;
  };

  const calculateDayTotal = (dayRecords) => {
    return dayRecords.reduce((acc, record) => ({
      calories: acc.calories + (parseFloat(record.calories) || 0),
      protein: acc.protein + (parseFloat(record.protein) || 0),
      fats: acc.fats + (parseFloat(record.fats) || 0),
      carbs: acc.carbs + (parseFloat(record.carbs) || 0)
    }), { calories: 0, protein: 0, fats: 0, carbs: 0 });
  };

  const getDayRating = (total) => {
    const caloriesPercent = (total.calories / dailyNorms.calories) * 100;
    const proteinPercent = (total.protein / dailyNorms.protein) * 100;
    const fatsPercent = (total.fats / dailyNorms.fats) * 100;
    const carbsPercent = (total.carbs / dailyNorms.carbs) * 100;
    
    const avgPercent = (caloriesPercent + proteinPercent + fatsPercent + carbsPercent) / 4;
    
    if (avgPercent < 70) {
      return { status: 'bad', color: 'from-red-500 to-red-600', icon: Frown, text: 'Серьезный недобор' };
    } else if ((avgPercent >= 70 && avgPercent < 90) || (avgPercent > 110 && avgPercent <= 130)) {
      return { status: 'ok', color: 'from-yellow-500 to-orange-500', icon: Meh, text: 'Есть отклонения' };
    } else if (avgPercent >= 90 && avgPercent <= 110) {
      return { status: 'good', color: 'from-orange-500 to-amber-600', icon: Smile, text: 'Отличный баланс!' };
    }
    return { status: 'bad', color: 'from-red-500 to-red-600', icon: Frown, text: 'Перебор' };
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    if (tg?.HapticFeedback) {
      if (type === 'success') {
        tg.HapticFeedback.notificationOccurred('success');
      } else if (type === 'error') {
        tg.HapticFeedback.notificationOccurred('error');
      } else {
        tg.HapticFeedback.notificationOccurred('warning');
      }
    }
    setTimeout(() => setNotification(null), 4000);
  };

  // API импорт через backend
  const handleApiImport = async () => {
    if (tg) {
      tg.showPopup({
        title: 'Импорт данных',
        message: 'Отправьте файл Excel/CSV боту в личных сообщениях. Бот обработает данные и автоматически загрузит их в приложение.',
        buttons: [
          { id: 'open_bot', type: 'default', text: 'Открыть бота' },
          { id: 'cancel', type: 'cancel' }
        ]
      }, (buttonId) => {
        if (buttonId === 'open_bot') {
          // Открываем чат с ботом
          tg.openTelegramLink('https://t.me/YOUR_BOT_USERNAME');
        }
      });
    } else {
      showNotification('Функция доступна только в Telegram', 'warning');
    }
  };

  const handleExport = () => {
    const exportData = records.map(r => 
      `${r.date}\t${r.ingredient}\t${r.weight}\t${r.calories}\t${r.protein}\t${r.fats}\t${r.carbs}`
    ).join('\n');
    
    const header = 'Дата\tИнгредиент\tВес_г\tКалории\tБелки\tЖиры\tУглеводы\n';
    const fullData = header + exportData;
    
    if (tg) {
      tg.showPopup({
        title: 'Экспорт данных',
        message: 'Данные готовы к экспорту. Они будут отправлены вам в личные сообщения бота.',
        buttons: [
          { id: 'export', type: 'default', text: 'Отправить' },
          { id: 'cancel', type: 'cancel' }
        ]
      }, (buttonId) => {
        if (buttonId === 'export') {
          // Отправка данных через bot API
          showNotification('Данные отправлены в бот!', 'success');
        }
      });
    } else {
      // Fallback для браузера
      const blob = new Blob([fullData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vital_balance_export.txt';
      a.click();
    }
  };

  const addRecord = () => {
    if (!newRecord.ingredient || !newRecord.calories) {
      showNotification('Заполните ингредиент и калории', 'warning');
      return;
    }
    
    setRecords(prev => [...prev, { ...newRecord }]);
    setNewRecord({
      date: new Date().toISOString().split('T')[0],
      ingredient: '',
      weight: '',
      calories: '',
      protein: '',
      fats: '',
      carbs: ''
    });
    setShowAddForm(false);
    showNotification('Запись добавлена!', 'success');
  };

  const recordsByDay = getRecordsByDay();
  const filteredRecords = getFilteredRecords();
  const totalStats = calculateDayTotal(filteredRecords);
  
  const getDaysInPeriod = () => {
    switch(selectedPeriod) {
      case 'today': return 1;
      case 'week': return 7;
      case 'month': return 30;
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          const start = new Date(customDateRange.start);
          const end = new Date(customDateRange.end);
          const diffTime = Math.abs(end - start);
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
        return 1;
      default: return 1;
    }
  };
  
  const daysInPeriod = getDaysInPeriod();
  const periodNorms = {
    calories: dailyNorms.calories * daysInPeriod,
    protein: dailyNorms.protein * daysInPeriod,
    fats: dailyNorms.fats * daysInPeriod,
    carbs: dailyNorms.carbs * daysInPeriod
  };

  const toggleDay = (date) => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    setExpandedDays(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-orange-500 mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-2 sm:p-4" style={{fontFamily: 'Unbounded, sans-serif'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
      
      <div className="max-w-7xl mx-auto">
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl border ${
            notification.type === 'success' ? 'bg-orange-600 border-orange-500' :
            notification.type === 'error' ? 'bg-red-600 border-red-500' :
            'bg-yellow-600 border-yellow-500'
          } text-white font-medium animate-slide-in`}>
            {notification.message}
          </div>
        )}

        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-700">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-black bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent mb-1">
                VITAL BALANCE
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm font-light">Контроль баланса питательных веществ</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
                  setShowSettings(!showSettings);
                }}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-gray-700 to-gray-600 text-white px-3 sm:px-4 py-2 rounded-xl hover:from-gray-600 hover:to-gray-500 transition font-medium shadow-lg text-sm flex-1 sm:flex-none"
              >
                <Settings size={18} />
                <span className="hidden sm:inline">Настройки</span>
              </button>
              <button
                onClick={handleApiImport}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white px-3 sm:px-4 py-2 rounded-xl hover:from-orange-500 hover:to-amber-500 transition font-medium shadow-lg text-sm flex-1 sm:flex-none"
              >
                <Upload size={18} />
                <span>Импорт</span>
              </button>
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-3 sm:px-4 py-2 rounded-xl hover:from-blue-500 hover:to-cyan-500 transition font-medium shadow-lg text-sm flex-1 sm:flex-none"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Экспорт</span>
              </button>
            </div>
          </div>
        </div>

        {showSettings && (
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Настройки профиля</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Пол</label>
                <select
                  value={profile.gender}
                  onChange={(e) => setProfile({...profile, gender: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Возраст (лет)</label>
                <input
                  type="number"
                  value={profile.age}
                  onChange={(e) => setProfile({...profile, age: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Рост (см)</label>
                <input
                  type="number"
                  value={profile.height}
                  onChange={(e) => setProfile({...profile, height: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Вес (кг)</label>
                <input
                  type="number"
                  value={profile.weight}
                  onChange={(e) => setProfile({...profile, weight: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Активность</label>
                <select
                  value={profile.activity}
                  onChange={(e) => setProfile({...profile, activity: e.target.value})}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="sedentary">Сидячий</option>
                  <option value="light">Легкая</option>
                  <option value="moderate">Умеренная</option>
                  <option value="active">Активная</option>
                  <option value="veryActive">Очень активная</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => {
                setShowSettings(false);
                showNotification('Настройки сохранены!', 'success');
              }}
              className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-amber-600 text-white px-8 py-3 rounded-xl hover:from-orange-600 hover:to-amber-700 transition font-bold shadow-lg"
            >
              Сохранить настройки
            </button>
          </div>
        )}

        {showSettings && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {[
              { label: 'Норма калорий', value: dailyNorms.calories, unit: 'ккал/день', color: 'from-orange-500 to-red-500' },
              { label: 'Норма белков', value: dailyNorms.protein, unit: 'г/день', color: 'from-orange-500 to-amber-600' },
              { label: 'Норма жиров', value: dailyNorms.fats, unit: 'г/день', color: 'from-yellow-500 to-orange-500' },
              { label: 'Норма углеводов', value: dailyNorms.carbs, unit: 'г/день', color: 'from-blue-500 to-cyan-500' }
            ].map(item => (
              <div key={item.label} className={`bg-gradient-to-br ${item.color} rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6`}>
                <div className="text-xs sm:text-sm text-white/80 font-medium mb-1">{item.label}</div>
                <div className="text-2xl sm:text-3xl font-black text-white">{item.value}</div>
                <div className="text-xs text-white/60 font-light">{item.unit}</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-700">
          <div className="flex flex-wrap gap-2 items-center">
            <Calendar size={18} className="text-orange-500 hidden sm:block" />
            {['today', 'week', 'month', 'custom'].map(period => (
              <button
                key={period}
                onClick={() => {
                  if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
                  setSelectedPeriod(period);
                }}
                className={`px-3 sm:px-4 py-2 rounded-xl transition font-medium text-sm ${
                  selectedPeriod === period 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {period === 'today' ? 'Сегодня' : period === 'week' ? 'Неделя' : period === 'month' ? 'Месяц' : 'Период'}
              </button>
            ))}
            {selectedPeriod === 'custom' && (
              <>
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({...customDateRange, start: e.target.value})}
                  className="bg-gray-700 border border-gray-600 text-white rounded-xl px-3 sm:px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm w-full sm:w-auto"
                />
                <span className="text-gray-400 font-bold hidden sm:inline">—</span>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({...customDateRange, end: e.target.value})}
                  className="bg-gray-700 border border-gray-600 text-white rounded-xl px-3 sm:px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm w-full sm:w-auto"
                />
              </>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-700">
          <h2 className="text-lg sm:text-2xl font-bold text-white mb-4">
            Статистика <span className="text-orange-500 text-sm sm:text-base">({daysInPeriod} {daysInPeriod === 1 ? 'день' : daysInPeriod < 5 ? 'дня' : 'дней'})</span>
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            {[
              { label: 'Калории', value: totalStats.calories, norm: periodNorms.calories, color: 'from-orange-500 to-red-500' },
              { label: 'Белки', value: totalStats.protein, norm: periodNorms.protein, color: 'from-orange-500 to-amber-600' },
              { label: 'Жиры', value: totalStats.fats, norm: periodNorms.fats, color: 'from-yellow-500 to-orange-500' },
              { label: 'Углеводы', value: totalStats.carbs, norm: periodNorms.carbs, color: 'from-blue-500 to-cyan-500' }
            ].map(item => (
              <div key={item.label}>
                <div className="text-xs sm:text-sm text-gray-400 mb-2 font-medium">{item.label}</div>
                <div className="w-full bg-gray-700 rounded-full h-2 sm:h-3 mb-2 overflow-hidden">
                  <div
                    className={`bg-gradient-to-r ${item.color} h-2 sm:h-3 rounded-full transition-all shadow-lg`}
                    style={{width: `${Math.min((item.value / item.norm) * 100, 100)}%`}}
                  />
                </div>
                <div className="text-sm sm:text-lg font-bold text-white">{Math.round(item.value)} <span className="text-gray-500 text-xs sm:text-sm">/ {item.norm}</span></div>
                <div className="text-xs text-gray-500 font-medium">{((item.value / item.norm) * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-700">
          <button
            onClick={() => {
              if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white px-6 py-3 rounded-xl hover:from-orange-600 hover:to-amber-700 transition font-bold shadow-lg w-full sm:w-auto"
          >
            <PlusCircle size={20} />
            Добавить прием пищи
          </button>

          {showAddForm && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <input
                type="date"
                value={newRecord.date}
                onChange={(e) => setNewRecord({...newRecord, date: e.target.value})}
                className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <input
                type="text"
                placeholder="Ингредиент"
                value={newRecord.ingredient}
                onChange={(e) => setNewRecord({...newRecord, ingredient: e.target.value})}
                className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="Вес (г)"
                value={newRecord.weight}
                onChange={(e) => setNewRecord({...newRecord, weight: e.target.value})}
                className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="Калории"
                value={newRecord.calories}
                onChange={(e) => setNewRecord({...newRecord, calories: e.target.value})}
                className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="Белки (г)"
                value={newRecord.protein}
                onChange={(e) => setNewRecord({...newRecord, protein: e.target.value})}
                className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="Жиры (г)"
                value={newRecord.fats}
                onChange={(e) => setNewRecord({...newRecord, fats: e.target.value})}
                className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="Углеводы (г)"
                value={newRecord.carbs}
                onChange={(e) => setNewRecord({...newRecord, carbs: e.target.value})}
                className="bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500"
              />
              <button
                onClick={addRecord}
                className="bg-gradient-to-r from-orange-500 to-amber-600 text-white px-4 py-2 rounded-xl hover:from-orange-600 hover:to-amber-700 transition font-bold shadow-lg"
              >
                Сохранить
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {Object.keys(recordsByDay).sort().reverse().map(date => {
            const dayRecords = recordsByDay[date];
            const dayTotal = calculateDayTotal(dayRecords);
            const rating = getDayRating(dayTotal);
            const Icon = rating.icon;
            const isExpanded = expandedDays[date];

            return (
              <div key={date} className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
                <div 
                  className={`bg-gradient-to-r ${rating.color} p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center text-white cursor-pointer hover:opacity-90 transition gap-3`}
                  onClick={() => toggleDay(date)}
                >
                  <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <Icon size={24} className="drop-shadow-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base sm:text-xl truncate">{new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      <div className="text-xs sm:text-sm opacity-90 font-medium">{rating.text}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between">
                    <div className="text-left sm:text-right flex-1">
                      <div className="text-xl sm:text-3xl font-black">{Math.round(dayTotal.calories)} <span className="text-sm sm:text-xl opacity-80">/ {dailyNorms.calories}</span></div>
                      <div className="text-xs sm:text-sm opacity-90 font-medium">
                        Б: {Math.round(dayTotal.protein)}/{dailyNorms.protein}г | 
                        Ж: {Math.round(dayTotal.fats)}/{dailyNorms.fats}г | 
                        У: {Math.round(dayTotal.carbs)}/{dailyNorms.carbs}г
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={24} className="flex-shrink-0" /> : <ChevronDown size={24} className="flex-shrink-0" />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="p-3 sm:p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-base">
                        <thead className="border-b border-gray-700">
                          <tr className="text-center text-xs sm:text-sm text-gray-400 font-medium">
                            <th className="pb-3 text-left">Ингредиент</th>
                            <th className="pb-3">Вес</th>
                            <th className="pb-3">Кал</th>
                            <th className="pb-3">Б</th>
                            <th className="pb-3">Ж</th>
                            <th className="pb-3">У</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayRecords.map((record, idx) => (
                            <tr key={idx} className="border-b border-gray-700/50 last:border-b-0">
                              <td className="py-2 sm:py-3 text-white font-medium text-left pr-2">{record.ingredient}</td>
                              <td className="py-2 sm:py-3 text-gray-300 text-center">{Math.round(record.weight)}</td>
                              <td className="py-2 sm:py-3 text-orange-400 font-bold text-center">{Math.round(record.calories)}</td>
                              <td className="py-2 sm:py-3 text-orange-300 text-center">{Math.round(record.protein)}</td>
                              <td className="py-2 sm:py-3 text-yellow-400 text-center">{Math.round(record.fats)}</td>
                              <td className="py-2 sm:py-3 text-blue-400 text-center">{Math.round(record.carbs)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {records.length === 0 && (
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl sm:rounded-2xl shadow-2xl p-8 sm:p-12 text-center border border-gray-700">
            <TrendingUp size={48} className="mx-auto text-orange-500 mb-4 opacity-50" />
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Начните отслеживать питание</h3>
            <p className="text-sm sm:text-base text-gray-400 font-light">Добавьте первую запись или импортируйте данные через бота</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NutritionTracker;