import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardList, Trees, Plus, X, Save, Trash2, ArrowLeft, Truck, Scissors, Wallet, CheckCircle, Settings, BarChart, FileText, PieChart, Building2, Users, Download, Upload, Printer, Pencil, Calculator, Smartphone
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
// ⚠️ DİKKAT: Kendi Firebase bilgilerinizi aşağıdaki tırnak içlerine yapıştırın!
const firebaseConfig = {
  apiKey: "AIzaSyCuK3-2ztkWaf5YAniEdzw94uT-ROr_Cqg",
  authDomain: "dfn-dikili.firebaseapp.com",
  projectId: "dfn-dikili",
  storageBucket: "dfn-dikili.firebasestorage.app",
  messagingSenderId: "707191398819",
  appId: "1:707191398819:web:19a5af8134d502347efa16",
  measurementId: "G-9V6N4XCHH2"
};


let app, auth, db, appId;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = 'dfn-sirket-hesabi';
} catch (e) {
  console.error("Firebase başlatılma hatası:", e);
}

// --- TARİH FORMATLAMA YARDIMCISI ---
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`; 
  }
  return dateStr;
};

// --- YIL AYIKLAMA YARDIMCISI ---
const extractYear = (dateStr) => {
    if (!dateStr) return 'Belirsiz';
    const match = String(dateStr).match(/(20\d{2})/);
    if (match) return match[1];
    if (!isNaN(dateStr) && dateStr > 30000) {
       const d = new Date((dateStr - 25569) * 86400 * 1000);
       return d.getFullYear().toString();
    }
    return 'Belirsiz';
};

export default function App() {
  const [activeMainTab, setActiveMainTab] = useState('dikili');
  const [user, setUser] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 4000); };

  // --- PWA (ANA EKRANA EKLEME) ALTYAPISI ---
  useEffect(() => {
    // Uygulama Manifestosunu (Kimliğini) Dinamik Olarak Oluştur
    const manifest = {
      name: "DFN Ormancılık",
      short_name: "DFN Orman",
      description: "İş Takip ve Maliyet Uygulaması",
      start_url: window.location.href,
      display: "standalone",
      background_color: "#064e3b",
      theme_color: "#064e3b",
      icons: [{
        src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzA2NGUzYiIvPjx0ZXh0IHg9IjUwIiB5PSI2MCIgZm9udC1zaXplPSI0MCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIj5ERk48L3RleHQ+PC9zdmc+",
        sizes: "192x192",
        type: "image/svg+xml"
      }]
    };
    
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);
    
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestURL;

    // iOS Cihazlar İçin Gerekli Meta Etiketleri
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
        const metaTags = [
            { name: 'theme-color', content: '#064e3b' },
            { name: 'apple-mobile-web-app-capable', content: 'yes' },
            { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
            { name: 'apple-mobile-web-app-title', content: 'DFN Orman' }
        ];
        metaTags.forEach(tag => {
            const meta = document.createElement('meta');
            meta.name = tag.name;
            meta.content = tag.content;
            document.head.appendChild(meta);
        });
    }

    // Android/Chrome için Yükleme Penceresi Yakalayıcı
    const handleBeforeInstall = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
      if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') setDeferredPrompt(null);
      } else {
          showToast("Safari'de 'Paylaş' menüsünden 'Ana Ekrana Ekle'ye dokunun. Chrome'da ise sağ üstteki üç noktadan 'Ana Ekrana Ekle' / 'Uygulamayı Yükle'yi seçin.");
      }
  };

  const handleExportData = async () => {
      if (!user || !db) {
          showToast("Veritabanı bağlantısı bekleniyor...");
          return;
      }
      try {
          const exportData = { dikili_satis_projects: [], tapulu_kesim_jobs: [], muhendislik_projeleri: [] };
          
          const dikiliSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'dikili_satis_projects'));
          dikiliSnap.forEach(document => exportData.dikili_satis_projects.push(document.data()));
          
          const tapuluSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'tapulu_kesim_jobs'));
          tapuluSnap.forEach(document => exportData.tapulu_kesim_jobs.push(document.data()));

          const muhSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'muhendislik_projeleri'));
          muhSnap.forEach(document => exportData.muhendislik_projeleri.push(document.data()));

          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
          const dl = document.createElement('a');
          dl.setAttribute("href", dataStr);
          dl.setAttribute("download", `orman_yedek_${new Date().toISOString().split('T')[0]}.json`);
          document.body.appendChild(dl);
          dl.click();
          dl.remove();
          showToast("Tüm verileriniz bilgisayara indirildi!");
      } catch (e) {
          console.error(e);
          showToast("Yedekleme sırasında hata oluştu.");
      }
  };

  const handleImportData = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const importedData = JSON.parse(event.target.result);
              if (user && db) {
                  if (importedData.dikili_satis_projects) {
                      for (let proj of importedData.dikili_satis_projects) {
                          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'dikili_satis_projects', proj.id), proj);
                      }
                  }
                  if (importedData.tapulu_kesim_jobs) {
                      for (let job of importedData.tapulu_kesim_jobs) {
                          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tapulu_kesim_jobs', job.id), job);
                      }
                  }
                  if (importedData.muhendislik_projeleri) {
                      for (let job of importedData.muhendislik_projeleri) {
                          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'muhendislik_projeleri', job.id), job);
                      }
                  }
                  showToast("Veriler başarıyla Ortak Havuza yüklendi!");
              } else {
                  showToast("Bağlantı hatası! Lütfen Firebase bilgilerinizi kontrol edin.");
              }
          } catch (err) {
              console.error(err);
              showToast("Geçersiz yedek dosyası.");
          }
      };
      reader.readAsText(file);
      e.target.value = null;
  };

  const MAIN_MENUS = [
    { id: 'dikili', name: 'Dikili Satış', icon: Trees },
    { id: 'tapulu', name: 'Tapulu Kesim', icon: Scissors },
    { id: 'muhendislik', name: 'Mühendislik', icon: FileText }
  ];

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (e) {}
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  return (
    <div className="h-screen bg-gray-100 flex flex-col md:flex-row font-sans overflow-hidden">
      {/* CSS FOR NATIVE FALLBACK PRINTING AND SCROLLBARS */}
      <style>{`
        @media print {
          html, body, #root { height: auto !important; overflow: visible !important; min-height: auto !important; }
          .h-screen { height: auto !important; overflow: visible !important; display: block !important; }
          .overflow-hidden { overflow: visible !important; }
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 10px !important; box-shadow: none !important; background: white !important; }
          .no-print, .no-print * { display: none !important; }
          .print-only-header { display: block !important; }
          .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .print-table th, .print-table td { border: 1px solid #444 !important; padding: 6px; text-align: left; font-size: 11px; color: #000 !important; }
          .print-table th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; color-adjust: exact; }
          .print-title { font-size: 20px; font-weight: bold; margin-bottom: 5px; color: #000; text-align: center; display: block !important; }
          .print-subtitle { font-size: 12px; color: #555; margin-bottom: 20px; text-align: center; display: block !important; }
          .print-summary { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px; }
          .print-summary-box { border: 1px solid #444 !important; padding: 8px; border-radius: 6px; flex: 1; min-width: 120px; text-align: center; background-color: transparent !important; }
        }
        
        .custom-scrollbar::-webkit-scrollbar { width: 12px; height: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #a8a29e; border-radius: 6px; border: 2px solid #f1f1f1; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #78716c; }
      `}</style>

      {toastMessage && <div className="fixed top-4 right-4 bg-gray-800 text-white shadow-xl p-4 rounded-lg z-[100] animate-fade-in no-print">{toastMessage}</div>}

      <div className="bg-emerald-900 text-white w-full md:w-64 flex-shrink-0 flex md:flex-col shadow-xl z-10 no-print">
        <div className="p-6 hidden md:block">
          <h1 className="text-xl font-bold flex items-center gap-2"><Trees className="w-5 h-5"/> DFN Ormancılık</h1>
          <p className="text-emerald-200 text-xs mt-1">İş Takibi & Maliyet</p>
        </div>
        <nav className="flex md:flex-col w-full overflow-x-auto custom-scrollbar flex-1 relative">
          {MAIN_MENUS.map((menu) => {
            const Icon = menu.icon;
            return (
              <button key={menu.id} onClick={() => setActiveMainTab(menu.id)} className={`flex flex-col md:flex-row items-center md:justify-start py-4 md:px-6 w-full ${activeMainTab === menu.id ? 'bg-emerald-800 border-l-4 border-emerald-400' : 'hover:bg-emerald-800 transition-colors'}`}>
                <Icon className="w-6 h-6 md:mr-3" /><span className="text-xs md:text-sm font-medium">{menu.name}</span>
              </button>
            );
          })}
          
          <div className="md:mt-auto md:w-full border-l md:border-l-0 md:border-t border-emerald-800 p-2 md:p-4 flex items-center justify-center shrink-0">
              <button onClick={handleInstallApp} className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 bg-emerald-700 hover:bg-emerald-600 text-white py-2 px-3 rounded-lg text-[10px] md:text-sm font-bold transition-colors border border-emerald-500 shadow md:w-full">
                  <Smartphone className="w-5 h-5 md:w-4 md:h-4"/> <span className="whitespace-nowrap">Uygulamayı Kur</span>
              </button>
          </div>
        </nav>
      </div>

      <div className="flex-1 overflow-hidden p-4 md:p-8 no-print-bg flex flex-col">
        <div className="max-w-7xl mx-auto w-full flex-grow flex flex-col min-h-0">
          
          <div className="mb-6 border-b bg-white px-4 py-3 rounded-xl shadow-sm flex justify-between items-center no-print shrink-0">
            <h2 className="font-bold text-gray-700 text-lg hidden sm:block">
                {MAIN_MENUS.find(m => m.id === activeMainTab)?.name} Yönetimi
            </h2>
            <div className="flex items-center space-x-1 flex-shrink-0 ml-auto">
                <span className="text-xs text-gray-400 mr-2 font-medium">Veri Yedeği:</span>
                <button onClick={handleExportData} className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors" title="Tüm Verileri İndir">
                    <Download className="w-4 h-4"/>
                </button>
                <label className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer m-0" title="Yedek Dosyasını Yükle">
                    <Upload className="w-4 h-4"/>
                    <input type="file" accept=".json" className="hidden" onChange={handleImportData} />
                </label>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 relative">
             {activeMainTab === 'dikili' && <DikiliSatisTakip user={user} db={db} appId={appId} showToast={showToast} />}
             {activeMainTab === 'tapulu' && <TapuluKesimTakip user={user} db={db} appId={appId} showToast={showToast} />}
             {activeMainTab === 'muhendislik' && <MuhendislikTakip user={user} db={db} appId={appId} showToast={showToast} />}
          </div>

        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODÜL 1: DİKİLİ SATIŞ İŞ TAKİBİ
// ----------------------------------------------------------------------
function DikiliSatisTakip({ user, db, appId, showToast }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'dikili_satis_projects'), (snapshot) => {
       const data = []; snapshot.forEach(doc => data.push(doc.data()));
       setProjects(data.sort((a, b) => b.createdAt - a.createdAt));
       if (activeProject) setActiveProject(data.find(p => p.id === activeProject.id));
    });
  }, [user, db, appId, activeProject?.id]);

  const handleCreateProject = async () => {
      if(!newProjectName.trim()) return;
      const newProj = { 
          id: `ds_${Date.now()}`, 
          isim: newProjectName, 
          createdAt: Date.now(), 
          ogmMatrah: '', ogmKdv: '', 
          aktifKesimciler: '', 
          tahminiOdunTon: '', tahminiTomrukTon: '', 
          odunSatisFiyat: '', tomrukSatisFiyat: '',
          kesimBirimFiyat: '', yuklemeBirimFiyat: '', nakliyeBirimFiyat: '',
          kamyonlar: [], kesimOdemeleri: [], nakliyeOdemeleri: [], digerGiderler: []
      };
      if(user && db) { 
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'dikili_satis_projects', newProj.id), newProj); 
          setShowAddModal(false); 
          setNewProjectName(''); 
          setActiveProject(newProj);
      }
  };

  if (activeProject) return <DikiliSatisDetay project={activeProject} onBack={() => setActiveProject(null)} user={user} db={db} appId={appId} showToast={showToast} />;

  return (
    <div className="space-y-6 no-print h-full overflow-y-auto custom-scrollbar pr-2 pb-6">
        <div className="flex justify-between items-center">
            <div>
               <h2 className="text-2xl font-bold">Dikili Satış Dosyaları</h2>
               <p className="text-sm text-gray-500">Maliyet ve Taşeron Takibi</p>
            </div>
            <button onClick={() => setShowAddModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center font-bold shadow-md hover:bg-emerald-700 transition-colors"><Plus className="w-5 h-5 mr-1" /> Yeni Bölme Aç</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projects.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                           <h3 className="font-bold text-lg text-emerald-800 leading-tight">{p.isim}</h3>
                        </div>
                        <div className="text-sm text-gray-600 space-y-2 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <p className="flex justify-between items-center"><span className="flex items-center"><Truck className="w-4 h-4 mr-2 text-blue-500"/> Kamyon (Satış/Nakliye)</span> <span className="font-bold bg-white px-2 py-0.5 rounded border">{p.kamyonlar?.length || 0}</span></p>
                            <p className="flex justify-between items-center"><span className="flex items-center"><Scissors className="w-4 h-4 mr-2 text-orange-500"/> Kesimci Ödemesi</span> <span className="font-bold bg-white px-2 py-0.5 rounded border">{p.kesimOdemeleri?.length || 0}</span></p>
                            <p className="flex justify-between items-center"><span className="flex items-center"><Wallet className="w-4 h-4 mr-2 text-red-500"/> Diğer Giderler</span> <span className="font-bold bg-white px-2 py-0.5 rounded border">{p.digerGiderler?.length || 0}</span></p>
                        </div>
                    </div>
                    <button onClick={() => setActiveProject(p)} className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold py-2.5 rounded-lg border border-emerald-200 transition-colors">Dosyayı Aç</button>
                </div>
            ))}
        </div>

        {showAddModal && (
            <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 pt-10 z-50 animate-fade-in no-print">
                <div className="bg-white rounded-xl w-full max-w-md shadow-2xl flex flex-col my-8">
                    <div className="p-5 border-b bg-gray-50 rounded-t-xl flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">Yeni Dikili Satış Projesi</h3>
                        <button onClick={()=>setShowAddModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-700"/></button>
                    </div>
                    <div className="p-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Proje / Bölme Adı</label>
                        <input type="text" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Örn: 125 Nolu Bölme" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} autoFocus />
                    </div>
                    <div className="p-5 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
                        <button onClick={()=>setShowAddModal(false)} className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-100">İptal</button>
                        <button onClick={handleCreateProject} className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-bold shadow-md hover:bg-emerald-700">Oluştur</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}

function DikiliSatisDetay({ project, onBack, user, db, appId, showToast }) {
    const [activeTab, setActiveTab] = useState('ozet');
    const [settings, setSettings] = useState({ 
        ogmMatrah: project.ogmMatrah || '', ogmKdv: project.ogmKdv || '',
        aktifKesimciler: project.aktifKesimciler || '',
        tahminiOdunTon: project.tahminiOdunTon || '', tahminiTomrukTon: project.tahminiTomrukTon || '',
        odunSatisFiyat: project.odunSatisFiyat || '', tomrukSatisFiyat: project.tomrukSatisFiyat || '',
        kesimBirimFiyat: project.kesimBirimFiyat || '', yuklemeBirimFiyat: project.yuklemeBirimFiyat || '', nakliyeBirimFiyat: project.nakliyeBirimFiyat || ''
    });

    const [summaryPlaka, setSummaryPlaka] = useState(null);
    const [summaryFirma, setSummaryFirma] = useState(null);
    const [summaryKesimci, setSummaryKesimci] = useState(null);
    const [showGenelRapor, setShowGenelRapor] = useState(false);
    const [deleteModal, setDeleteModal] = useState(null);

    // KESİN ÇÖZÜM: Tüm verileri ID garantili olarak yükle, Firebase undefined hatasına karşı derin kopyalama yap
    const kamyonlar = useMemo(() => (project.kamyonlar || []).map((k, i) => k.id ? k : { ...k, id: `legacy_kmy_${i}` }), [project.kamyonlar]);
    const kesimOdemeleri = useMemo(() => (project.kesimOdemeleri || []).map((k, i) => k.id ? k : { ...k, id: `legacy_ksm_${i}` }), [project.kesimOdemeleri]);
    const nakliyeOdemeleri = useMemo(() => (project.nakliyeOdemeleri || []).map((k, i) => k.id ? k : { ...k, id: `legacy_nok_${i}` }), [project.nakliyeOdemeleri]);
    const digerGiderler = useMemo(() => (project.digerGiderler || []).map((k, i) => k.id ? k : { ...k, id: `legacy_gid_${i}` }), [project.digerGiderler]);

    const updateField = async (field, value) => { 
        if(user && db) {
            try {
                // Firebase'in eski/hatalı verilerdeki tanımsız (undefined) değerleri reddetmesini engeller
                const safeValue = JSON.parse(JSON.stringify(value));
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'dikili_satis_projects', project.id), { [field]: safeValue }, { merge: true }); 
            } catch (err) {
                console.error("Firebase Update Error:", err);
                showToast("Veritabanı güncelleme hatası. Veri formatı bozuk olabilir.");
            }
        } 
    };

    const deleteRecord = (e, arrayName, currentArray, id, confirmMsg) => {
        e.stopPropagation();
        setDeleteModal({ arrayName, currentArray, id, confirmMsg });
    };

    const confirmDeleteAction = () => {
        if (!deleteModal) return;
        const { arrayName, currentArray, id } = deleteModal;
        const updated = currentArray.filter(x => x.id !== id);
        updateField(arrayName, updated);
        showToast("Kayıt başarıyla silindi.");
        setDeleteModal(null);
    };

    const saveSettings = async () => { if(user && db) { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'dikili_satis_projects', project.id), settings, { merge: true }); showToast("Tahmin ve maliyet ayarları kaydedildi."); } };

    const uniquePlakalar = useMemo(() => [...new Set(kamyonlar.map(k => k.plaka).filter(Boolean).map(p => p.toLocaleUpperCase('tr-TR')))], [kamyonlar]);
    const uniqueFirmalar = useMemo(() => [...new Set(kamyonlar.map(k => k.firma || k.musteri).filter(Boolean).map(f => f.toLocaleUpperCase('tr-TR')))], [kamyonlar]);
    const uniqueKesimciler = useMemo(() => {
        const list = (settings.aktifKesimciler || '').split(',').map(s => s.trim().toLocaleUpperCase('tr-TR')).filter(Boolean);
        kamyonlar.forEach(k => { if (k.kesimci && !list.includes(k.kesimci.toLocaleUpperCase('tr-TR'))) list.push(k.kesimci.toLocaleUpperCase('tr-TR')); });
        return list;
    }, [settings.aktifKesimciler, kamyonlar]);

    const toplamDigerGider = digerGiderler.reduce((sum, g) => sum + (parseFloat(g.tutar)||0), 0);

    const tahOdunT = parseFloat(settings.tahminiOdunTon)||0; const tahTomrukT = parseFloat(settings.tahminiTomrukTon)||0; const tahTopTon = tahOdunT + tahTomrukT;
    const tahGelir = (tahOdunT * (parseFloat(settings.odunSatisFiyat)||0)) + (tahTomrukT * (parseFloat(settings.tomrukSatisFiyat)||0));
    const tahGider = (parseFloat(settings.ogmMatrah)||0) + (tahTopTon * (parseFloat(settings.kesimBirimFiyat)||0)) + (tahTopTon * (parseFloat(settings.yuklemeBirimFiyat)||0)) + (tahTopTon * (parseFloat(settings.nakliyeBirimFiyat)||0)) + toplamDigerGider;
    const tahKdvHaricKar = tahGelir - tahGider;
    const tahNetKar = tahKdvHaricKar * 0.75; 

    let gerOdunTon = 0, gerTomrukTon = 0, gerOdunCiro = 0, gerTomrukCiro = 0, gerTahsilEdilen = 0;
    let gerNakliyeGideri = 0, gerNakliyeOdenen = 0;
    
    let tSatisHakedis = 0, tSatisKalan = 0;
    let tNakHakedis = 0, tNakKalan = 0;
    let tKamyonTon = 0;

    let tFatSatisMatrah = 0, tFatSatisKdv = 0;
    let tFatNakliyeMatrah = 0, tFatNakliyeKdv = 0;

    kamyonlar.forEach(k => {
        const ton = parseFloat(k.tonaj) || 0; 
        tKamyonTon += ton;
        const satisBf = parseFloat(k.satisBirimFiyat ?? k.birimFiyat) || 0; 
        const satisMatrah = ton * satisBf;
        const satisKdvDahil = satisMatrah + (satisMatrah * ((parseFloat(k.satisKdvOrani ?? k.kdvOrani) || 0) / 100));
        const satisAlinan = parseFloat(k.alinanNakit ?? k.alinan) || 0; 
        const satisKalan = satisKdvDahil - satisAlinan;
        
        tSatisHakedis += satisKdvDahil;
        tSatisKalan += satisKalan;

        if (!k.faturasizSatis) {
            tFatSatisMatrah += satisMatrah;
            tFatSatisKdv += (satisMatrah * ((parseFloat(k.satisKdvOrani ?? k.kdvOrani) || 0) / 100));
        }

        const nakBf = parseFloat(k.nakliyeBirimFiyat) || 0;
        const nakMatrah = ton * nakBf;
        const nakKdv = nakMatrah * ((parseFloat(k.nakliyeKdvOrani) || 0) / 100);
        const nakTevk = nakKdv * (parseFloat(k.nakliyeTevkifatOrani) || 0);
        const nakHakedis = nakMatrah + nakKdv - nakTevk;
        const nakOdenen = parseFloat(k.nakliyeOdenen) || 0;
        const nakKalan = nakHakedis - nakOdenen;

        tNakHakedis += nakHakedis;
        tNakKalan += nakKalan;

        if (!k.faturasizNakliye) {
            tFatNakliyeMatrah += nakMatrah;
            tFatNakliyeKdv += (nakMatrah * ((parseFloat(k.nakliyeKdvOrani) || 0) / 100));
        }

        if((k.cinsi||'').toLowerCase().includes('odun')) { gerOdunTon += ton; gerOdunCiro += satisMatrah; } 
        else { gerTomrukTon += ton; gerTomrukCiro += satisMatrah; }
        
        gerTahsilEdilen += parseFloat(k.alinanNakit ?? k.alinan) || 0;
        gerNakliyeGideri += nakMatrah;
        gerNakliyeOdenen += parseFloat(k.nakliyeOdenen) || 0;
    });

    nakliyeOdemeleri.forEach(n => {
        gerNakliyeGideri += (parseFloat(n.tonaj)||0)*(parseFloat(n.birimFiyat)||0); // Legacy destek
        gerNakliyeOdenen += parseFloat(n.odenen)||0;
    });

    const gerTopTonaj = gerOdunTon + gerTomrukTon;
    const gerGelir = gerOdunCiro + gerTomrukCiro;
    const gerKesimGideri = gerTopTonaj * (parseFloat(settings.kesimBirimFiyat) || 0);
    let gerKesimOdenen = 0;
    kesimOdemeleri.forEach(k => { gerKesimOdenen += parseFloat(k.odenen)||0; });
    const gerGider = (parseFloat(settings.ogmMatrah)||0) + gerKesimGideri + gerNakliyeGideri + toplamDigerGider;
    const gerKdvHaricKar = gerGelir - gerGider;
    const gerNetKar = gerKdvHaricKar * 0.75;

    const ogmMatrahTutar = parseFloat(settings.ogmMatrah) || 0;
    const ogmKdvYuzde = settings.ogmKdv !== undefined && settings.ogmKdv !== '' ? parseFloat(settings.ogmKdv) : 20;
    const ogmKdvTutar = ogmMatrahTutar * (ogmKdvYuzde / 100);

    // KAMYON (SATIŞ/NAKLİYE) İŞLEMLERİ
    const [showKModal, setShowKModal] = useState(false); 
    const [editingKId, setEditingKId] = useState(null);
    const [kForm, setKForm] = useState({ 
        tarih: new Date().toISOString().split('T')[0], plaka: '', firma: '', cinsi: 'Tomruk', 
        tonaj: '', kesimci: '', satisBirimFiyat: '', satisKdvOrani: '20', alinanNakit: '', 
        nakliyeBirimFiyat: '', nakliyeKdvOrani: '0', nakliyeTevkifatOrani: '0', nakliyeOdenen: '',
        faturasizSatis: false, faturasizNakliye: false
    });

    const handlePlakaChange = (val) => {
        const plakaVal = val.toLocaleUpperCase('tr-TR');
        let updates = { plaka: plakaVal };
        const lastKamyon = [...kamyonlar].reverse().find(k => k.plaka?.toLocaleUpperCase('tr-TR') === plakaVal);
        if (lastKamyon) {
            updates.nakliyeBirimFiyat = lastKamyon.nakliyeBirimFiyat || '';
            updates.nakliyeKdvOrani = lastKamyon.nakliyeKdvOrani || '0';
            updates.nakliyeTevkifatOrani = lastKamyon.nakliyeTevkifatOrani || '0';
        }
        setKForm({...kForm, ...updates});
    };

    const handleFirmaChange = (val) => {
        const firmaVal = val.toLocaleUpperCase('tr-TR');
        let updates = { firma: firmaVal };
        const lastFirma = [...kamyonlar].reverse().find(k => (k.firma || k.musteri)?.toLocaleUpperCase('tr-TR') === firmaVal);
        if (lastFirma) {
            updates.satisBirimFiyat = lastFirma.satisBirimFiyat ?? lastFirma.birimFiyat ?? '';
            updates.satisKdvOrani = lastFirma.satisKdvOrani ?? lastFirma.kdvOrani ?? '20';
            updates.nakliyeBirimFiyat = lastFirma.nakliyeBirimFiyat ?? '';
            updates.nakliyeKdvOrani = lastFirma.nakliyeKdvOrani ?? '0';
            updates.nakliyeTevkifatOrani = lastFirma.nakliyeTevkifatOrani ?? '0';
        }
        setKForm({...kForm, ...updates});
    };
    
    const openKamyonModal = () => { 
        setKForm({ tarih: new Date().toISOString().split('T')[0], plaka: '', firma: '', cinsi: 'Tomruk', tonaj: '', kesimci: uniqueKesimciler[0] || '', satisBirimFiyat: '', satisKdvOrani: '20', alinanNakit: '', nakliyeBirimFiyat: '', nakliyeKdvOrani: '0', nakliyeTevkifatOrani: '0', nakliyeOdenen: '', faturasizSatis: false, faturasizNakliye: false }); 
        setEditingKId(null); 
        setShowKModal(true); 
    };
    
    const editKamyon = (k) => { 
        setKForm({...k, faturasizSatis: k.faturasizSatis || false, faturasizNakliye: k.faturasizNakliye || false}); 
        setEditingKId(k.id); 
        setShowKModal(true); 
    };
    
    const handleSaveK = () => { 
        const finalForm = { ...kForm };
        if (finalForm.firma) finalForm.firma = finalForm.firma.toLocaleUpperCase('tr-TR');
        if (finalForm.plaka) finalForm.plaka = finalForm.plaka.toLocaleUpperCase('tr-TR');
        if (finalForm.faturasizSatis) finalForm.satisKdvOrani = '0';
        if (finalForm.faturasizNakliye) finalForm.nakliyeKdvOrani = '0';

        if (editingKId) {
            const updated = kamyonlar.map(x => x.id === editingKId ? { ...finalForm, id: editingKId } : x);
            updateField('kamyonlar', updated);
            showToast("Kamyon seferi başarıyla güncellendi.");
        } else {
            updateField('kamyonlar', [...kamyonlar, {...finalForm, id: `kmy_${Date.now()}` }]);
            showToast("Kamyon seferi eklendi.");
        }
        setShowKModal(false); 
        setEditingKId(null);
    };

    // KESİMCİ İŞLEMLERİ
    const [showKesimModal, setShowKesimModal] = useState(false); 
    const [editingKesimId, setEditingKesimId] = useState(null);
    const [kesimForm, setKesimForm] = useState({ tarih: new Date().toISOString().split('T')[0], taseron: '', odenen: '' });
    const openKesimModal = () => { setKesimForm({tarih: new Date().toISOString().split('T')[0], taseron: uniqueKesimciler[0] || '', odenen: ''}); setEditingKesimId(null); setShowKesimModal(true); };
    const editKesim = (kItem) => { setKesimForm({ ...kItem }); setEditingKesimId(kItem.id); setShowKesimModal(true); };
    const handleSaveKesim = () => { 
        if (editingKesimId) {
            const updated = kesimOdemeleri.map(x => x.id === editingKesimId ? { ...kesimForm, id: editingKesimId } : x);
            updateField('kesimOdemeleri', updated);
            showToast("Kesim ödemesi güncellendi.");
        } else {
            updateField('kesimOdemeleri', [...kesimOdemeleri, {...kesimForm, id: `ksm_${Date.now()}` }]); 
            showToast("Kesim ödemesi eklendi."); 
        }
        setShowKesimModal(false); 
        setEditingKesimId(null);
    };

    // NAKLİYAT ÖDEME İŞLEMLERİ (YENİ)
    const [showNakliyeOdemesiModal, setShowNakliyeOdemesiModal] = useState(false);
    const [nakliyeOdemesiForm, setNakliyeOdemesiForm] = useState({ tarih: new Date().toISOString().split('T')[0], plaka: '', odenen: '' });
    const openNakliyeOdemesiModal = () => { setNakliyeOdemesiForm({tarih: new Date().toISOString().split('T')[0], plaka: uniquePlakalar[0] || '', odenen: ''}); setShowNakliyeOdemesiModal(true); };
    const handleSaveNakliyeOdemesi = () => {
        const formToSave = { ...nakliyeOdemesiForm, plaka: nakliyeOdemesiForm.plaka.toLocaleUpperCase('tr-TR') };
        updateField('nakliyeOdemeleri', [...nakliyeOdemeleri, {...formToSave, id: `nok_${Date.now()}` }]); 
        setShowNakliyeOdemesiModal(false); 
        showToast("Nakliyeci toplu ödemesi eklendi."); 
    };

    // GİDER İŞLEMLERİ
    const [showGiderModal, setShowGiderModal] = useState(false);
    const [giderForm, setGiderForm] = useState({ tarih: new Date().toISOString().split('T')[0], aciklama: '', tutar: '' });
    const handleSaveGider = () => { updateField('digerGiderler', [...digerGiderler, {...giderForm, id: `gider_${Date.now()}` }]); setShowGiderModal(false); showToast("Gider eklendi."); };

    // --- EKSİK YARDIMCI FONKSİYONLAR (BURAYA EKLENDİ) ---
    const getFirmaLedger = (firmaAdi) => {
        let cumulative = 0;
        const target = (firmaAdi || '').trim().toLocaleUpperCase('tr-TR');
        return kamyonlar
            .filter(k => ((k.firma || k.musteri) || '').trim().toLocaleUpperCase('tr-TR') === target)
            .sort((a, b) => new Date(a.tarih) - new Date(b.tarih))
            .map(k => {
                const tonaj = parseFloat(k.tonaj) || 0;
                const bf = parseFloat(k.satisBirimFiyat ?? k.birimFiyat) || 0;
                const satisMatrah = tonaj * bf;
                const hakedis = satisMatrah + (satisMatrah * ((parseFloat(k.satisKdvOrani ?? k.kdvOrani) || 0) / 100));
                const odenen = parseFloat(k.alinanNakit ?? k.alinan) || 0;
                cumulative += (hakedis - odenen);
                return { ...k, hakedis, odenen, bf, bakiye: cumulative };
            });
    };

    const getKesimciLedger = (kesimciAdi) => {
        const ledger = [];
        const kAdi = (kesimciAdi || '').trim().toLocaleUpperCase('tr-TR');
        kamyonlar.filter(k => (k.kesimci || '').trim().toLocaleUpperCase('tr-TR') === kAdi).forEach(k => {
            const tonaj = parseFloat(k.tonaj) || 0;
            const hakedis = tonaj * (parseFloat(settings.kesimBirimFiyat) || 0);
            ledger.push({ tarih: k.tarih, islem: `Kesim Hakedişi (${k.plaka})`, tonaj, hakedis, odenen: 0 });
        });
        kesimOdemeleri.filter(o => (o.taseron || '').trim().toLocaleUpperCase('tr-TR') === kAdi).forEach(o => {
            const odenen = parseFloat(o.odenen) || 0;
            ledger.push({ tarih: o.tarih, islem: `Nakit Ödeme`, tonaj: 0, hakedis: 0, odenen });
        });
        let cumulative = 0;
        return ledger.sort((a, b) => new Date(a.tarih) - new Date(b.tarih)).map(l => {
            cumulative += (l.hakedis - l.odenen);
            return { ...l, bakiye: cumulative };
        });
    };

    const getPlakaLedger = (plaka) => {
        let cumulative = 0;
        const ledger = [];
        const target = (plaka || '').trim().toLocaleUpperCase('tr-TR');
        
        kamyonlar.filter(k => (k.plaka || '').trim().toLocaleUpperCase('tr-TR') === target).forEach(k => {
            const tonaj = parseFloat(k.tonaj) || 0;
            const bf = parseFloat(k.nakliyeBirimFiyat) || 0;
            const nakMatrah = tonaj * bf;
            const nakKdv = nakMatrah * ((parseFloat(k.nakliyeKdvOrani) || 0) / 100);
            const nakTevk = nakKdv * (parseFloat(k.nakliyeTevkifatOrani) || 0);
            const hakedis = nakMatrah + nakKdv - nakTevk;
            const odenen = parseFloat(k.nakliyeOdenen) || 0;
            ledger.push({ ...k, islem: `Nakliye Seferi`, hakedis, odenen, bf, tonaj });
        });

        nakliyeOdemeleri.filter(n => (n.plaka || '').trim().toLocaleUpperCase('tr-TR') === target && !n.tonaj).forEach(n => {
            const odenen = parseFloat(n.odenen) || 0;
            ledger.push({ tarih: n.tarih, islem: `Toplu Ödeme / Nakit`, tonaj: 0, hakedis: 0, odenen, bf: 0 });
        });

        return ledger.sort((a, b) => new Date(a.tarih) - new Date(b.tarih)).map(l => {
            cumulative += (l.hakedis - l.odenen);
            return { ...l, bakiye: cumulative };
        });
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10 h-full overflow-y-auto custom-scrollbar pr-2 relative flex flex-col">
            <div className="bg-emerald-900 text-white p-5 rounded-xl shadow-lg flex flex-col md:flex-row items-start md:items-center gap-4 relative overflow-hidden no-print shrink-0">
                <Trees className="w-48 h-48 absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4" />
                <button onClick={onBack} className="p-2 bg-emerald-800 hover:bg-emerald-700 rounded-lg transition-colors border border-emerald-700 z-10"><ArrowLeft className="w-5 h-5" /></button>
                <div className="z-10">
                    <h2 className="text-xl md:text-2xl font-bold">{project.isim}</h2>
                    <p className="text-emerald-200 text-sm">Dikili Satış Şantiye Kontrol Paneli</p>
                </div>
            </div>

            <div className="flex overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200 p-1 custom-scrollbar no-print shrink-0">
                <button onClick={()=>setActiveTab('ozet')} className={`flex-1 min-w-[160px] py-3 text-sm font-bold rounded-md flex justify-center items-center gap-2 transition-colors ${activeTab==='ozet'?'bg-emerald-100 text-emerald-800':'text-gray-500 hover:bg-gray-50'}`}><BarChart className="w-4 h-4"/> GENEL ÖZET</button>
                <button onClick={()=>setActiveTab('kamyon')} className={`flex-1 min-w-[180px] py-3 text-sm font-bold rounded-md flex justify-center items-center gap-2 transition-colors ${activeTab==='kamyon'?'bg-blue-100 text-blue-800':'text-gray-500 hover:bg-gray-50'}`}><Truck className="w-4 h-4"/> KAMYON (SATIŞ & NAKLİYE)</button>
                <button onClick={()=>setActiveTab('kesim')} className={`flex-1 min-w-[160px] py-3 text-sm font-bold rounded-md flex justify-center items-center gap-2 transition-colors ${activeTab==='kesim'?'bg-orange-100 text-orange-800':'text-gray-500 hover:bg-gray-50'}`}><Scissors className="w-4 h-4"/> KESİMCİ ÖDEMELERİ</button>
                <button onClick={()=>setActiveTab('nakliye_odemeleri')} className={`flex-1 min-w-[180px] py-3 text-sm font-bold rounded-md flex justify-center items-center gap-2 transition-colors ${activeTab==='nakliye_odemeleri'?'bg-purple-100 text-purple-800':'text-gray-500 hover:bg-gray-50'}`}><Truck className="w-4 h-4"/> NAKLİYE ÖDEMELERİ</button>
                <button onClick={()=>setActiveTab('giderler')} className={`flex-1 min-w-[160px] py-3 text-sm font-bold rounded-md flex justify-center items-center gap-2 transition-colors ${activeTab==='giderler'?'bg-red-100 text-red-800':'text-gray-500 hover:bg-gray-50'}`}><Wallet className="w-4 h-4"/> DİĞER GİDERLER</button>
            </div>

            {/* TAB İÇERİKLERİ */}
            {activeTab === 'ozet' && (
                <div className="space-y-6 no-print">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-5">
                            <div className="flex justify-between items-center border-b pb-2"><h3 className="font-bold text-gray-800 flex items-center"><FileText className="w-4 h-4 mr-2 text-emerald-600"/> Ayarlar & Tahmin</h3><button onClick={saveSettings} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded font-bold hover:bg-emerald-200 shadow-sm">Kaydet</button></div>
                            <div className="space-y-4">
                                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                    <label className="text-xs font-bold text-orange-800 mb-1 flex items-center"><Users className="w-3 h-3 mr-1"/> Aktif Kesimciler (Virgülle Ayırın)</label>
                                    <input type="text" className="w-full p-2 border border-orange-200 rounded focus:ring-2 focus:ring-orange-500 bg-white text-sm" value={settings.aktifKesimciler} onChange={e=>setSettings({...settings, aktifKesimciler:e.target.value})} />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1"><label className="text-xs font-bold text-gray-600">OGM Matrahı (₺)</label><input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 font-bold" value={settings.ogmMatrah} onChange={e=>setSettings({...settings, ogmMatrah:e.target.value})} /></div>
                                    <div className="w-1/3"><label className="text-xs font-bold text-gray-600">OGM KDV (%)</label><input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 font-bold" value={settings.ogmKdv !== undefined ? settings.ogmKdv : '20'} onChange={e=>setSettings({...settings, ogmKdv:e.target.value})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label className="text-[10px] font-bold text-gray-600">Tahmini Odun (Ton)</label><input type="number" className="w-full p-2 border rounded text-sm" value={settings.tahminiOdunTon} onChange={e=>setSettings({...settings, tahminiOdunTon:e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-gray-600">Odun Satış Fiyat (₺)</label><input type="number" className="w-full p-2 border rounded text-sm" value={settings.odunSatisFiyat} onChange={e=>setSettings({...settings, odunSatisFiyat:e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-gray-600">Tahmini Tomruk (Ton)</label><input type="number" className="w-full p-2 border rounded text-sm" value={settings.tahminiTomrukTon} onChange={e=>setSettings({...settings, tahminiTomrukTon:e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-gray-600">Tomruk Satış Fiyat (₺)</label><input type="number" className="w-full p-2 border rounded text-sm" value={settings.tomrukSatisFiyat} onChange={e=>setSettings({...settings, tomrukSatisFiyat:e.target.value})} /></div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div><label className="text-[10px] font-bold text-gray-600">Birim Kesim (₺)</label><input type="number" className="w-full p-2 border rounded text-sm font-bold text-orange-700" value={settings.kesimBirimFiyat} onChange={e=>setSettings({...settings, kesimBirimFiyat:e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-gray-600">Birim Yükleme(₺)</label><input type="number" className="w-full p-2 border rounded text-sm" value={settings.yuklemeBirimFiyat} onChange={e=>setSettings({...settings, yuklemeBirimFiyat:e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-gray-600">Birim Nakliye(₺)</label><input type="number" className="w-full p-2 border rounded text-sm" value={settings.nakliyeBirimFiyat} onChange={e=>setSettings({...settings, nakliyeBirimFiyat:e.target.value})} /></div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-gray-200 bg-gray-50 p-2 rounded">
                                    <h4 className="text-xs font-black text-gray-600 mb-2">PROJE TAHMİNİ KAR / ZARAR</h4>
                                    <div className="flex justify-between items-center text-xs mb-1"><span className="text-gray-500">Tahmini Gelir:</span><span className="font-bold text-emerald-700">{tahGelir.toLocaleString('tr-TR')} ₺</span></div>
                                    <div className="flex justify-between items-center text-xs mb-1"><span className="text-gray-500">Tahmini Gider (OGM+Kesim+Nakliye):</span><span className="font-bold text-red-700">{(tahGider - toplamDigerGider).toLocaleString('tr-TR')} ₺</span></div>
                                    <div className="flex justify-between items-center text-xs mb-1"><span className="text-gray-500">Gerçekleşen Diğer Giderler:</span><span className="font-bold text-red-700">{toplamDigerGider.toLocaleString('tr-TR')} ₺</span></div>
                                    <div className="flex justify-between items-center text-sm mt-1 pt-1 border-t"><span className="font-bold text-gray-800">Tahmini Net Kar:</span><span className={`font-black ${tahKdvHaricKar >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{tahKdvHaricKar.toLocaleString('tr-TR')} ₺</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                            <div className="flex justify-between items-center border-b pb-3 mb-5">
                                <h3 className="font-bold text-gray-800 flex items-center"><PieChart className="w-5 h-5 mr-2 text-indigo-600"/> TARİHİ İTİBARİYLE DURUM</h3>
                                <button onClick={() => setShowGenelRapor(true)} className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded font-bold hover:bg-black shadow-sm flex items-center"><Printer className="w-3 h-3 mr-1"/> Genel Döküm Al</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                                <div>
                                    <h4 className="text-sm font-black text-red-700 mb-3 bg-red-50 p-2 rounded">GİDERLER (KDV HARİÇ)</h4>
                                    <ul className="space-y-3 text-sm">
                                        <li className="flex justify-between border-b pb-1"><span className="text-gray-600">O.G.M Fatura:</span> <span className="font-bold">{(parseFloat(settings.ogmMatrah)||0).toLocaleString('tr-TR')} ₺</span></li>
                                        <li className="flex justify-between border-b pb-1"><span className="text-gray-600">Kesme ({gerTopTonaj.toFixed(1)} t):</span> <span className="font-bold">{gerKesimGideri.toLocaleString('tr-TR')} ₺</span></li>
                                        <li className="flex justify-between border-b pb-1"><span className="text-gray-600">Nakliye ({gerTopTonaj.toFixed(1)} t):</span> <span className="font-bold">{gerNakliyeGideri.toLocaleString('tr-TR')} ₺</span></li>
                                        <li className="flex justify-between border-b pb-1"><span className="text-gray-600">Diğer Giderler (SGK vb.):</span> <span className="font-bold text-red-500">{toplamDigerGider.toLocaleString('tr-TR')} ₺</span></li>
                                        <li className="flex justify-between pt-2 text-base"><span className="font-bold text-red-800">TOPLAM GİDER:</span> <span className="font-black text-red-600">{gerGider.toLocaleString('tr-TR')} ₺</span></li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-emerald-700 mb-3 bg-emerald-50 p-2 rounded">GELİRLER (KDV HARİÇ)</h4>
                                    <ul className="space-y-3 text-sm h-full flex flex-col">
                                        <li className="flex justify-between border-b pb-1"><span className="text-gray-600">Odun ({gerOdunTon.toFixed(1)} t):</span> <span className="font-bold text-emerald-700">{gerOdunCiro.toLocaleString('tr-TR')} ₺</span></li>
                                        <li className="flex justify-between border-b pb-1"><span className="text-gray-600">Tomruk ({gerTomrukTon.toFixed(1)} t):</span> <span className="font-bold text-emerald-700">{gerTomrukCiro.toLocaleString('tr-TR')} ₺</span></li>
                                        <div className="mt-auto">
                                            <li className="flex justify-between pt-2 text-base border-t border-gray-200"><span className="font-bold text-emerald-800">TOPLAM GELİR:</span> <span className="font-black text-emerald-600">{gerGelir.toLocaleString('tr-TR')} ₺</span></li>
                                        </div>
                                    </ul>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div className="pt-4 border border-gray-200 bg-gray-50 rounded-xl p-5 text-center shadow-sm flex flex-col justify-center">
                                    <h3 className="text-sm font-bold text-gray-500 mb-2">GERÇEKLEŞEN NAKİT KAR / ZARAR</h3>
                                    <div className={`text-3xl font-black ${gerKdvHaricKar >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {gerKdvHaricKar >= 0 ? '+' : ''}{gerKdvHaricKar.toLocaleString('tr-TR')} ₺
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 font-medium">*(Fiili gerçekleşen tüm gelir ve giderlerin KDV hariç farkı)</p>
                                </div>
                                
                                <div className="pt-4 border border-blue-200 bg-blue-50 rounded-xl p-5 shadow-sm">
                                    <h3 className="text-sm font-bold text-blue-800 mb-3 border-b border-blue-200 pb-2 flex justify-between items-center">
                                        <span>RESMİ VERGİ & KDV DURUMU</span>
                                        <Calculator className="w-4 h-4" />
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center"><span className="text-gray-600">Resmi Gelir Matrahı:</span> <span className="font-bold">{tFatSatisMatrah.toLocaleString('tr-TR')} ₺</span></div>
                                        <div className="flex justify-between items-center"><span className="text-gray-600">Resmi Gider (OGM+Nakliye):</span> <span className="font-bold">{(ogmMatrahTutar + tFatNakliyeMatrah).toLocaleString('tr-TR')} ₺</span></div>
                                        <div className="flex justify-between items-center pt-2 border-t border-blue-200"><span className="font-black text-gray-800">Vergi (Kurumlar) Matrahı:</span> <span className={`font-black ${(tFatSatisMatrah - (ogmMatrahTutar + tFatNakliyeMatrah)) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{(tFatSatisMatrah - (ogmMatrahTutar + tFatNakliyeMatrah)).toLocaleString('tr-TR')} ₺</span></div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-blue-200 space-y-2 text-sm">
                                        <div className="flex justify-between items-center"><span className="text-gray-600">Hesaplanan KDV (Müşteriden):</span> <span className="font-bold">{tFatSatisKdv.toLocaleString('tr-TR')} ₺</span></div>
                                        <div className="flex justify-between items-center"><span className="text-gray-600">İndirilecek KDV (Ödenen):</span> <span className="font-bold">{(ogmKdvTutar + tFatNakliyeKdv).toLocaleString('tr-TR')} ₺</span></div>
                                        <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                                            <span className="font-black text-blue-900">KDV Özet Durumu:</span> 
                                            <span className={`font-black ${ (tFatSatisKdv - (ogmKdvTutar + tFatNakliyeKdv)) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {(tFatSatisKdv - (ogmKdvTutar + tFatNakliyeKdv)) > 0 ? 'Ödenecek: ' : 'Devreden: '}
                                                {Math.abs(tFatSatisKdv - (ogmKdvTutar + tFatNakliyeKdv)).toLocaleString('tr-TR')} ₺
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-white p-3 rounded-xl border shadow-sm flex flex-col justify-center relative">
                            <p className="text-xs text-gray-500 font-bold">Müşteriden Tahsilat</p>
                            <p className="text-lg font-bold text-blue-600 mt-1">{gerTahsilEdilen.toLocaleString('tr-TR')} ₺</p>
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <p className="text-[11px] text-red-600 font-black">Kalan Alacak: {tSatisKalan.toLocaleString('tr-TR')} ₺</p>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border shadow-sm flex flex-col justify-center relative">
                            <p className="text-xs text-gray-500 font-bold">Kesimciye Ödenen</p>
                            <p className="text-lg font-bold text-orange-600 mt-1">{gerKesimOdenen.toLocaleString('tr-TR')} ₺</p>
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <p className="text-[11px] text-red-600 font-black">Kalan Borç: {(gerKesimGideri - gerKesimOdenen).toLocaleString('tr-TR')} ₺</p>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border shadow-sm flex flex-col justify-center relative">
                            <p className="text-xs text-gray-500 font-bold">Nakliyeciye Ödenen</p>
                            <p className="text-lg font-bold text-purple-600 mt-1">{gerNakliyeOdenen.toLocaleString('tr-TR')} ₺</p>
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <p className="text-[11px] text-red-600 font-black">Kalan Borç: {(gerNakliyeGideri - gerNakliyeOdenen).toLocaleString('tr-TR')} ₺</p>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border shadow-sm flex flex-col justify-center">
                            <p className="text-xs text-gray-500 font-bold">Diğer Giderlere Ödenen</p>
                            <p className="text-lg font-bold text-red-600 mt-1">{toplamDigerGider.toLocaleString('tr-TR')} ₺</p>
                        </div>
                        <div className="bg-gray-800 p-3 rounded-xl border border-gray-700 shadow-sm flex flex-col justify-center">
                            <p className="text-xs text-gray-300 font-bold">Kalan Serbest Nakit</p>
                            <p className="text-xl font-bold text-white mt-1">{(gerTahsilEdilen - gerKesimOdenen - gerNakliyeOdenen - toplamDigerGider).toLocaleString('tr-TR')} ₺</p>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAYLI KAMYON TABLOSU VE YATAY KAYDIRMA */}
            {activeTab === 'kamyon' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden no-print flex flex-col flex-1 min-h-[400px]">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center gap-3 shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center"><Truck className="w-5 h-5 mr-2 text-blue-600"/> Giden Kamyonlar (Fatura & Tahsilat Detaylı)</h3>
                        <button onClick={openKamyonModal} className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-blue-700"><Plus className="w-4 h-4 mr-1 inline"/> Kamyon Ekle</button>
                    </div>
                    <div className="overflow-auto flex-1 custom-scrollbar relative">
                        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1400px]">
                            <thead className="bg-white sticky top-0 z-20 shadow-sm text-gray-500 text-[11px] uppercase font-bold">
                                <tr>
                                    <th colSpan="6" className="p-2 border-b border-r border-gray-200 text-center bg-gray-50 text-gray-700">Genel Bilgiler</th>
                                    <th colSpan="4" className="p-2 border-b border-r border-gray-200 text-center bg-emerald-50 text-emerald-800">Müşteri Satış / Tahsilat</th>
                                    <th colSpan="4" className="p-2 border-b border-gray-200 text-center bg-purple-50 text-purple-800">Nakliye / Ödeme</th>
                                    <th rowSpan="2" className="p-3 border-b text-center border-l bg-gray-100 sticky right-0 z-30 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]">İşlem</th>
                                </tr>
                                <tr>
                                    <th className="p-3 border-b">Tarih</th><th className="p-3 border-b">Plaka</th><th className="p-3 border-b">Müşteri</th><th className="p-3 border-b">Cinsi</th><th className="p-3 border-b text-orange-600">Kesimci</th><th className="p-3 border-b border-r border-gray-200 text-right">Tonaj</th>
                                    
                                    <th className="p-3 border-b text-right bg-emerald-50/30">Birim Fiyat</th><th className="p-3 border-b text-right bg-emerald-50/30">Hakediş (KDV'li)</th><th className="p-3 border-b text-right text-emerald-700 font-bold bg-emerald-50/30">Alınan Nakit</th><th className="p-3 border-b text-right text-red-600 font-bold border-r border-gray-200 bg-emerald-50/30">Borç</th>
                                    
                                    <th className="p-3 border-b text-right bg-purple-50/30">Nak. B.Fiyat</th><th className="p-3 border-b text-right bg-purple-50/30">Nak. Hakediş</th><th className="p-3 border-b text-right text-purple-700 font-bold bg-purple-50/30">Nak. Ödenen</th><th className="p-3 border-b text-right text-red-500 font-bold bg-purple-50/30">Nak. Alacak</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {kamyonlar.length === 0 ? (
                                    <tr><td colSpan="15" className="p-8 text-center text-gray-500">Henüz kamyon kaydı bulunamadı.</td></tr>
                                ) : (
                                    kamyonlar.map((k) => {
                                        const ton = parseFloat(k.tonaj) || 0;
                                        // Satis Hesaplamaları
                                        const satisBf = parseFloat(k.satisBirimFiyat ?? k.birimFiyat) || 0;
                                        const satisMatrah = ton * satisBf;
                                        const satisKdvDahil = satisMatrah + (satisMatrah * ((parseFloat(k.satisKdvOrani ?? k.kdvOrani) || 0) / 100));
                                        const satisAlinan = parseFloat(k.alinanNakit ?? k.alinan) || 0; 
                                        const satisKalan = satisKdvDahil - satisAlinan;
                                        
                                        // Nakliye Hesaplamaları
                                        const nakBf = parseFloat(k.nakliyeBirimFiyat) || 0;
                                        const nakMatrah = ton * nakBf;
                                        const nakKdv = nakMatrah * ((parseFloat(k.nakliyeKdvOrani) || 0) / 100);
                                        const nakTevk = nakKdv * (parseFloat(k.nakliyeTevkifatOrani) || 0);
                                        const nakHakedis = nakMatrah + nakKdv - nakTevk;
                                        const nakOdenen = parseFloat(k.nakliyeOdenen) || 0;
                                        const nakKalan = nakHakedis - nakOdenen;

                                        return (
                                            <tr key={k.id} className="hover:bg-gray-50 transition-colors group">
                                                <td className="p-3 text-gray-700">{formatDate(k.tarih)}</td>
                                                <td className="p-3 font-bold border-r bg-gray-50/30">
                                                    <button onClick={() => setSummaryPlaka(k.plaka)} className="hover:text-blue-600 hover:underline">{k.plaka}</button>
                                                </td>
                                                <td className="p-3 font-bold text-gray-800">
                                                    {(k.firma || k.musteri) ? (
                                                        <button onClick={() => setSummaryFirma(k.firma || k.musteri)} className="hover:text-emerald-700 hover:underline flex items-center">
                                                            <Building2 className="w-3 h-3 mr-1"/> {k.firma || k.musteri}
                                                        </button>
                                                    ) : '-'}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${k.cinsi === 'Odun' ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}>{k.cinsi}</span>
                                                </td>
                                                <td className="p-3 text-orange-600 font-bold">
                                                    {k.kesimci ? (
                                                        <button onClick={() => setSummaryKesimci(k.kesimci)} className="hover:underline">{k.kesimci}</button>
                                                    ) : '-'}
                                                </td>
                                                <td className="p-3 font-black text-right border-r border-gray-100 text-blue-700 bg-blue-50/20">{parseFloat(k.tonaj||0)} t</td>
                                                
                                                <td className="p-3 text-right bg-emerald-50/10">
                                                    {satisBf} ₺
                                                    {k.faturasizSatis && <span className="block text-[10px] text-red-600 font-bold bg-red-50 mt-1 rounded px-1 w-max ml-auto">Faturasız</span>}
                                                </td>
                                                <td className="p-3 text-right bg-emerald-50/10 text-gray-800 font-bold">{satisKdvDahil.toLocaleString('tr-TR')} ₺</td>
                                                <td className="p-3 text-right text-emerald-600 font-bold bg-emerald-50/10">{satisAlinan > 0 ? satisAlinan.toLocaleString('tr-TR') + ' ₺' : '-'}</td>
                                                <td className={`p-3 text-right font-black border-r border-gray-200 bg-emerald-50/30 ${satisKalan > 0 ? 'text-red-600' : 'text-gray-400'}`}>{satisKalan > 0 ? satisKalan.toLocaleString('tr-TR') + ' ₺' : 'Yok'}</td>
                                                
                                                <td className="p-3 text-right bg-purple-50/10">
                                                    {nakBf} ₺
                                                    {k.faturasizNakliye && <span className="block text-[10px] text-red-600 font-bold bg-red-50 mt-1 rounded px-1 w-max ml-auto">Faturasız</span>}
                                                </td>
                                                <td className="p-3 text-right bg-purple-50/10 text-gray-800 font-bold">{nakHakedis.toLocaleString('tr-TR')} ₺</td>
                                                <td className="p-3 text-right text-purple-600 font-bold bg-purple-50/10">{nakOdenen > 0 ? nakOdenen.toLocaleString('tr-TR') + ' ₺' : '-'}</td>
                                                <td className={`p-3 text-right font-black bg-purple-50/30 ${nakKalan > 0 ? 'text-red-500' : 'text-gray-400'}`}>{nakKalan > 0 ? nakKalan.toLocaleString('tr-TR') + ' ₺' : 'Yok'}</td>

                                                <td className="p-3 text-center border-l border-gray-200 sticky right-0 z-10 bg-white group-hover:bg-gray-50 no-print shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] transition-colors">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => editKamyon(k)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"><Pencil className="w-4 h-4"/></button>
                                                        <button onClick={(e) => deleteRecord(e, 'kamyonlar', kamyonlar, k.id, "Kamyon seferi silinsin mi?")} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {kamyonlar.length > 0 && (
                                <tfoot className="bg-gray-800 text-white font-bold sticky bottom-0 z-20 shadow-[0_-5px_10px_-5px_rgba(0,0,0,0.1)] text-sm">
                                    <tr>
                                        <td colSpan="5" className="p-3 text-right">GENEL TOPLAM:</td>
                                        <td className="p-3 text-right text-blue-300">{tKamyonTon.toFixed(2)} t</td>
                                        <td className="p-3 bg-emerald-900/50"></td>
                                        <td className="p-3 text-right bg-emerald-900/50">{tSatisHakedis.toLocaleString('tr-TR')} ₺</td>
                                        <td className="p-3 text-right bg-emerald-900/50 text-emerald-300">{gerTahsilEdilen.toLocaleString('tr-TR')} ₺</td>
                                        <td className="p-3 text-right bg-emerald-900/50 text-red-300 border-r border-gray-600">{tSatisKalan.toLocaleString('tr-TR')} ₺</td>
                                        <td className="p-3 bg-purple-900/50"></td>
                                        <td className="p-3 text-right bg-purple-900/50">{tNakHakedis.toLocaleString('tr-TR')} ₺</td>
                                        <td className="p-3 text-right bg-purple-900/50 text-purple-300">{gerNakliyeOdenen.toLocaleString('tr-TR')} ₺</td>
                                        <td className="p-3 text-right bg-purple-900/50 text-red-300">{tNakKalan.toLocaleString('tr-TR')} ₺</td>
                                        <td className="p-3 border-l border-gray-600 bg-gray-800"></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}
            
            {activeTab === 'kesim' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden no-print flex flex-col flex-1 min-h-[400px]">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center">Haftalık Nakit / Kesimci Ödeme Geçmişi</h3>
                        <button onClick={openKesimModal} className="bg-orange-600 text-white px-4 py-2 rounded font-bold shadow"><Plus className="w-4 h-4 inline mr-1"/> Ödeme Gir</button>
                    </div>
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white sticky top-0 shadow-sm z-10 text-gray-500 text-[11px] uppercase font-bold">
                                <tr><th className="p-3 border-b">Tarih</th><th className="p-3 border-b">Kesimci Adı</th><th className="p-3 border-b text-right text-emerald-700 font-bold">Verilen Tutar</th><th className="p-3 border-b text-center">İşlem</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {kesimOdemeleri.map((k) => (
                                    <tr key={k.id} className="hover:bg-gray-50">
                                        <td className="p-3 text-gray-600">{formatDate(k.tarih)}</td>
                                        <td className="p-3 font-bold text-gray-800">
                                            <button onClick={() => setSummaryKesimci(k.taseron)} className="hover:text-orange-600 hover:underline">{k.taseron}</button>
                                        </td>
                                        <td className="p-3 text-right text-emerald-600 font-bold text-lg">{(parseFloat(k.odenen)||0).toLocaleString('tr-TR')} ₺</td>
                                        <td className="p-3 text-center border-l border-gray-200 sticky right-0 z-10 bg-white group-hover:bg-gray-50 no-print shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] transition-colors">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => editKesim(k)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Düzenle"><Pencil className="w-4 h-4"/></button>
                                                <button onClick={(e) => deleteRecord(e, 'kesimOdemeleri', kesimOdemeleri, k.id, "Kesim ödemesi silinsin mi?")} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors" title="Sil"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {kesimOdemeleri.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-gray-400">Henüz kesimci ödemesi bulunmuyor.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'nakliye_odemeleri' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden no-print flex flex-col flex-1 min-h-[400px]">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center">Nakliyeci Toplu Ödeme Geçmişi</h3>
                        <button onClick={openNakliyeOdemesiModal} className="bg-purple-600 text-white px-4 py-2 rounded font-bold shadow"><Plus className="w-4 h-4 inline mr-1"/> Toplu Ödeme Gir</button>
                    </div>
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white sticky top-0 shadow-sm z-10 text-gray-500 text-[11px] uppercase font-bold">
                                <tr><th className="p-3 border-b">Tarih</th><th className="p-3 border-b">Araç Plakası</th><th className="p-3 border-b text-right text-purple-700 font-bold">Ödenen Tutar</th><th className="p-3 border-b text-center">İşlem</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {nakliyeOdemeleri.map((n) => {
                                    if (n.tonaj) return null; // Kamyonlardan gelen legacy verileri gizle
                                    return (
                                    <tr key={n.id} className="hover:bg-gray-50">
                                        <td className="p-3 text-gray-600">{formatDate(n.tarih)}</td>
                                        <td className="p-3 font-bold text-gray-800">
                                            <button onClick={() => setSummaryPlaka(n.plaka)} className="hover:text-purple-600 hover:underline">{n.plaka}</button>
                                        </td>
                                        <td className="p-3 text-right text-purple-600 font-bold text-lg">{(parseFloat(n.odenen)||0).toLocaleString('tr-TR')} ₺</td>
                                        <td className="p-3 text-center border-l border-gray-200 sticky right-0 z-10 bg-white group-hover:bg-gray-50 no-print shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] transition-colors">
                                            <button onClick={(e) => deleteRecord(e, 'nakliyeOdemeleri', nakliyeOdemeleri, n.id, "Nakliye ödemesi silinsin mi?")} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors" title="Sil"><Trash2 className="w-4 h-4"/></button>
                                        </td>
                                    </tr>
                                    );
                                })}
                                {nakliyeOdemeleri.filter(n => !n.tonaj).length === 0 && <tr><td colSpan="4" className="p-8 text-center text-gray-400">Henüz toplu nakliye ödemesi bulunmuyor.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'giderler' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden no-print flex flex-col flex-1 min-h-[400px]">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center">Diğer Şantiye Giderleri</h3>
                        <button onClick={()=>setShowGiderModal(true)} className="bg-red-600 text-white px-4 py-2 rounded font-bold shadow"><Plus className="w-4 h-4 inline mr-1"/> Gider Ekle</button>
                    </div>
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white sticky top-0 shadow-sm z-10 text-gray-500 text-[11px] uppercase font-bold">
                                <tr><th className="p-3 border-b">Tarih</th><th className="p-3 border-b">Açıklama (Gider Türü)</th><th className="p-3 border-b text-right font-bold text-gray-800">Tutar</th><th className="p-3 border-b text-center">İşlem</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {digerGiderler.map((g) => (
                                    <tr key={g.id} className="hover:bg-gray-50">
                                        <td className="p-3 text-gray-600">{formatDate(g.tarih)}</td><td className="p-3 font-bold text-gray-800">{g.aciklama}</td>
                                        <td className="p-3 text-right font-bold text-red-600 text-lg">{parseFloat(g.tutar||0).toLocaleString('tr-TR')} ₺</td>
                                        <td className="p-3 text-center"><button onClick={(e) => deleteRecord(e, 'digerGiderler', digerGiderler, g.id, "Gider kaydı silinsin mi?")} className="text-gray-400 hover:text-red-600 p-1 rounded" title="Sil"><Trash2 className="w-4 h-4 mx-auto"/></button></td>
                                    </tr>
                                ))}
                                {digerGiderler.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-gray-400">Henüz gider kaydı bulunmuyor.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            {/* KAMYON VERİ GİRİŞ/DÜZENLEME MODALI */}
            {showKModal && (
               <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 pt-10 z-[100] animate-fade-in overflow-y-auto no-print">
                 <div className="bg-white p-6 rounded-xl w-full max-w-4xl shadow-2xl my-8 border border-gray-200">
                    <div className="flex justify-between items-center mb-5 border-b pb-3 bg-gray-50 -mx-6 -mt-6 p-5 rounded-t-xl">
                        <h3 className="font-bold text-blue-800 text-xl flex items-center"><Truck className="mr-2"/> {editingKId ? 'Kamyon Seferini Düzenle' : 'Giden Kamyon Ekle (Satış ve Nakliye)'}</h3>
                        <button onClick={()=>setShowKModal(false)}><X className="text-gray-400 hover:text-gray-700 w-6 h-6"/></button>
                    </div>
                    <div className="space-y-6">
                        {/* 1. Kısım: Genel */}
                        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                            <h4 className="text-sm font-black text-gray-500 mb-4 uppercase border-b pb-2">Genel Bilgiler</h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div><label className="text-xs font-bold text-gray-700 block mb-1">Tarih</label><input type="date" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={kForm.tarih} onChange={e=>setKForm({...kForm, tarih:e.target.value})}/></div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Plaka</label>
                                    <input type="text" list="plakaListesi" className="w-full p-2.5 border rounded-lg font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Plaka girin veya listeden seçin" value={kForm.plaka} onChange={e=>handlePlakaChange(e.target.value)}/>
                                    <datalist id="plakaListesi">{uniquePlakalar.map(p => <option key={p} value={p} />)}</datalist>
                                </div>
                                <div><label className="text-xs font-bold text-gray-700 block mb-1">Cinsi</label><select className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={kForm.cinsi} onChange={e=>setKForm({...kForm, cinsi:e.target.value})}><option>Tomruk</option><option>Odun</option></select></div>
                                <div><label className="text-xs font-bold text-gray-700 block mb-1">Tonaj (t)</label><input type="number" step="0.01" className="w-full p-2.5 border rounded-lg border-blue-300 bg-blue-50 text-blue-900 font-black focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" value={kForm.tonaj} onChange={e=>setKForm({...kForm, tonaj:e.target.value})}/></div>
                            </div>
                            <div className="mt-4 border-t border-gray-200 pt-4">
                                <label className="text-xs font-bold text-orange-700 block mb-1">Bu Ürünü Kesen (Kesimci Seç)</label>
                                <select className="w-full p-2.5 border border-orange-200 rounded-lg bg-orange-50 font-bold text-orange-900 focus:ring-2 focus:ring-orange-500 outline-none" value={kForm.kesimci} onChange={e=>setKForm({...kForm, kesimci:e.target.value})}>
                                    <option value="">-- Kesimci Seçilmedi --</option>
                                    {uniqueKesimciler.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 2. Kısım: Satış */}
                            <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200 relative flex flex-col">
                                <h4 className="text-sm font-black text-emerald-800 mb-4 uppercase border-b border-emerald-200 pb-2 flex justify-between items-center">
                                    Müşteri Satış & Tahsilat
                                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg shadow-sm border border-emerald-300 transition-colors hover:bg-emerald-50">
                                        <input type="checkbox" className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer" checked={kForm.faturasizSatis} onChange={e => {
                                            const isChecked = e.target.checked;
                                            setKForm({...kForm, faturasizSatis: isChecked, satisKdvOrani: isChecked ? '0' : '20'});
                                        }} />
                                        <span className="text-xs font-bold text-red-600">FATURASIZ SATIŞ</span>
                                    </label>
                                </h4>
                                <div className="space-y-4 flex-1">
                                    <div>
                                        <label className="text-xs font-bold text-emerald-900 block mb-1">Gittiği Firma (Müşteri)</label>
                                        <input type="text" list="firmaListesi" className="w-full p-2.5 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none uppercase font-bold" placeholder="Kime satıldı?" value={kForm.firma} onChange={e=>handleFirmaChange(e.target.value)}/>
                                        <datalist id="firmaListesi">{uniqueFirmalar.map(f => <option key={f} value={f} />)}</datalist>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-bold text-gray-700 block mb-1">Birim Fiyat (₺)</label><input type="number" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0.00" value={kForm.satisBirimFiyat} onChange={e=>setKForm({...kForm, satisBirimFiyat:e.target.value})}/></div>
                                        <div><label className="text-xs font-bold text-gray-700 block mb-1">KDV Oranı (%)</label><select className="w-full p-2.5 border rounded-lg disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-emerald-500 outline-none font-bold" disabled={kForm.faturasizSatis} value={kForm.satisKdvOrani} onChange={e=>setKForm({...kForm, satisKdvOrani:e.target.value})}><option value="0">KDV Yok</option><option value="10">%10 KDV</option><option value="20">%20 KDV</option></select></div>
                                    </div>
                                    <div className="mt-auto pt-4"><label className="text-xs font-black text-emerald-800 block mb-1">Alınan Nakit (Müşteri Ödemesi) ₺</label><input type="number" className="w-full p-3 border-2 border-emerald-400 bg-white rounded-lg text-emerald-900 font-black text-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0.00" value={kForm.alinanNakit} onChange={e=>setKForm({...kForm, alinanNakit:e.target.value})}/></div>
                                </div>
                            </div>

                            {/* 3. Kısım: Nakliye */}
                            <div className="bg-purple-50 p-5 rounded-xl border border-purple-200 relative flex flex-col">
                                <h4 className="text-sm font-black text-purple-800 mb-4 uppercase border-b border-purple-200 pb-2 flex justify-between items-center">
                                    Nakliye & Ödeme
                                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg shadow-sm border border-purple-300 transition-colors hover:bg-purple-50">
                                        <input type="checkbox" className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer" checked={kForm.faturasizNakliye} onChange={e => {
                                            const isChecked = e.target.checked;
                                            setKForm({...kForm, faturasizNakliye: isChecked, nakliyeKdvOrani: isChecked ? '0' : '20'});
                                        }} />
                                        <span className="text-xs font-bold text-red-600">FATURASIZ NAKLİYE</span>
                                    </label>
                                </h4>
                                <div className="space-y-4 flex-1">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-bold text-gray-700 block mb-1">Nakliye B.Fiyat (₺)</label><input type="number" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="0.00" value={kForm.nakliyeBirimFiyat} onChange={e=>setKForm({...kForm, nakliyeBirimFiyat:e.target.value})}/></div>
                                        <div><label className="text-xs font-bold text-gray-700 block mb-1">KDV Oranı (%)</label><select className="w-full p-2.5 border rounded-lg disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-purple-500 outline-none font-bold" disabled={kForm.faturasizNakliye} value={kForm.nakliyeKdvOrani} onChange={e=>setKForm({...kForm, nakliyeKdvOrani:e.target.value})}><option value="0">KDV Yok</option><option value="20">%20 KDV</option></select></div>
                                    </div>
                                    <div><label className="text-xs font-bold text-gray-700 block mb-1">KDV Tevkifatı</label><select className="w-full p-2.5 border rounded-lg disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-purple-500 outline-none font-bold" disabled={kForm.nakliyeKdvOrani==='0' || kForm.faturasizNakliye} value={kForm.nakliyeTevkifatOrani} onChange={e=>setKForm({...kForm, nakliyeTevkifatOrani:e.target.value})}><option value="0">Tevkifat Yok</option><option value="0.2">2/10 (Taşıma İşleri)</option><option value="0.5">5/10</option></select></div>
                                    
                                    <div className="mt-auto pt-4"><label className="text-xs font-black text-purple-900 block mb-1">Nakliyeciye Ödenen Nakit (₺)</label><input type="number" className="w-full p-3 border-2 border-purple-400 bg-white rounded-lg text-purple-900 font-black text-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="0.00" value={kForm.nakliyeOdenen} onChange={e=>setKForm({...kForm, nakliyeOdenen:e.target.value})}/></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3 border-t pt-5">
                        <button onClick={()=>setShowKModal(false)} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-100">İptal</button>
                        <button onClick={handleSaveK} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md text-lg">{editingKId ? 'Değişiklikleri Kaydet' : 'Kamyonu Ekle'}</button>
                    </div>
                 </div>
               </div>
            )}

            {/* KESİMCİ MODALI */}
            {showKesimModal && (
               <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 pt-10 z-[100] animate-fade-in no-print">
                 <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl my-8">
                    <div className="flex justify-between items-center mb-5 border-b pb-2">
                        <h3 className="font-bold text-orange-800 text-lg flex items-center"><Scissors className="w-5 h-5 mr-2"/> {editingKesimId ? 'Kesim Ödemesini Düzenle' : 'Haftalık Kesim Ödemesi Gir'}</h3>
                        <button onClick={()=>setShowKesimModal(false)}><X className="text-gray-400 hover:text-gray-700"/></button>
                    </div>
                    <div className="space-y-4">
                        <div><label className="text-xs font-bold text-gray-600 mb-1 block">Tarih</label><input type="date" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" value={kesimForm.tarih} onChange={e=>setKesimForm({...kesimForm, tarih:e.target.value})}/></div>
                        <div><label className="text-xs font-bold text-gray-600 mb-1 block">Hangi Kesimciye Ödendi?</label><select className="w-full p-3 border rounded-lg font-bold focus:ring-2 focus:ring-orange-500 outline-none" value={kesimForm.taseron} onChange={e=>setKesimForm({...kesimForm, taseron:e.target.value})}><option value="">-- Kesimci Seçin --</option>{uniqueKesimciler.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
                        <div><label className="text-xs font-black text-emerald-700 mb-1 block">Verilen Para (Nakit/Elden) ₺</label><input type="number" className="w-full p-3 border-2 border-emerald-400 bg-emerald-50 text-emerald-900 text-xl font-black rounded-lg shadow-inner focus:ring-2 focus:ring-emerald-600 outline-none" placeholder="0.00" value={kesimForm.odenen} onChange={e=>setKesimForm({...kesimForm, odenen:e.target.value})}/></div>
                    </div>
                    <div className="mt-6 flex gap-2">
                        <button onClick={()=>setShowKesimModal(false)} className="w-1/3 border rounded-lg bg-white text-gray-700 font-bold hover:bg-gray-100">İptal</button>
                        <button onClick={handleSaveKesim} disabled={!kesimForm.taseron || !kesimForm.odenen} className="w-2/3 bg-orange-600 hover:bg-orange-700 text-white p-3 rounded-lg font-bold shadow-md disabled:opacity-50">{editingKesimId ? 'Değişiklikleri Kaydet' : 'Ödemeyi Kaydet'}</button>
                    </div>
                 </div>
               </div>
            )}

            {/* GİDER MODALI */}
            {showGiderModal && (
               <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 pt-10 z-[100] animate-fade-in no-print">
                 <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl my-8">
                    <div className="flex justify-between items-center mb-5 border-b pb-2"><h3 className="font-bold text-red-800 text-lg flex items-center"><Wallet className="w-5 h-5 mr-2" /> Şantiye Gideri Ekle</h3><button onClick={()=>setShowGiderModal(false)}><X className="text-gray-400 hover:text-gray-700"/></button></div>
                    <div className="mb-3"><label className="text-xs font-bold text-gray-600 block mb-1">Tarih</label><input type="date" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none" value={giderForm.tarih} onChange={e=>setGiderForm({...giderForm, tarih:e.target.value})}/></div>
                    <div className="mb-3">
                        <label className="text-xs font-bold text-gray-600 block mb-1">Açıklama (Ne İçin Harcandı?)</label>
                        <input type="text" list="giderTurleri" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none font-bold" placeholder="SGK, Mazot, Yemek vb." value={giderForm.aciklama} onChange={e=>setGiderForm({...giderForm, aciklama:e.target.value})}/>
                        <datalist id="giderTurleri"><option value="SGK"/><option value="İş Güvenliği"/><option value="Şantiye Kira"/><option value="Yemek/Erzak"/><option value="Nalburiye/Hırdavat"/></datalist>
                    </div>
                    <div className="mb-6"><label className="text-xs font-black text-red-800 block mb-1">Gider Tutarı (₺)</label><input type="number" className="w-full p-3 border-2 border-red-300 bg-red-50 text-red-900 font-black text-xl rounded-lg focus:ring-2 focus:ring-red-500 outline-none" placeholder="0.00" value={giderForm.tutar} onChange={e=>setGiderForm({...giderForm, tutar:e.target.value})}/></div>
                    <button onClick={handleSaveGider} className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg font-bold shadow-md text-lg">Gideri Kaydet</button>
                 </div>
               </div>
            )}

            {/* NAKLİYE ÖDEMESİ MODALI */}
            {showNakliyeOdemesiModal && (
               <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 pt-10 z-[100] animate-fade-in no-print">
                 <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl my-8">
                    <div className="flex justify-between items-center mb-5 border-b pb-2">
                        <h3 className="font-bold text-purple-800 text-lg flex items-center"><Truck className="w-5 h-5 mr-2"/> Toplu Nakliye Ödemesi Gir</h3>
                        <button onClick={()=>setShowNakliyeOdemesiModal(false)}><X className="text-gray-400 hover:text-gray-700"/></button>
                    </div>
                    <div className="space-y-4">
                        <div><label className="text-xs font-bold text-gray-600 mb-1 block">Tarih</label><input type="date" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" value={nakliyeOdemesiForm.tarih} onChange={e=>setNakliyeOdemesiForm({...nakliyeOdemesiForm, tarih:e.target.value})}/></div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 mb-1 block">Hangi Araç / Nakliyeci?</label>
                            <input type="text" list="plakaListesiNakliye" className="w-full p-3 border rounded-lg font-bold uppercase focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Plaka seçin veya yazın" value={nakliyeOdemesiForm.plaka} onChange={e=>setNakliyeOdemesiForm({...nakliyeOdemesiForm, plaka:e.target.value.toLocaleUpperCase('tr-TR')})}/>
                            <datalist id="plakaListesiNakliye">{uniquePlakalar.map(p => <option key={p} value={p} />)}</datalist>
                        </div>
                        <div><label className="text-xs font-black text-purple-700 mb-1 block">Ödenen Tutar (₺)</label><input type="number" className="w-full p-3 border-2 border-purple-400 bg-purple-50 text-purple-900 text-xl font-black rounded-lg shadow-inner focus:ring-2 focus:ring-purple-600 outline-none" placeholder="0.00" value={nakliyeOdemesiForm.odenen} onChange={e=>setNakliyeOdemesiForm({...nakliyeOdemesiForm, odenen:e.target.value})}/></div>
                    </div>
                    <div className="mt-6 flex gap-2">
                        <button onClick={()=>setShowNakliyeOdemesiModal(false)} className="w-1/3 border rounded-lg bg-white text-gray-700 font-bold hover:bg-gray-100">İptal</button>
                        <button onClick={handleSaveNakliyeOdemesi} disabled={!nakliyeOdemesiForm.plaka || !nakliyeOdemesiForm.odenen} className="w-2/3 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg font-bold shadow-md disabled:opacity-50">Ödemeyi Kaydet</button>
                    </div>
                 </div>
               </div>
            )}

            {/* --- YAZDIRILABİLİR DETAY RAPOR MODALLARI (Cari Ekstreler) --- */}

            {/* 1. FİRMA (MÜŞTERİ) DETAY VE YAZDIRMA EKRANI */}
            {summaryFirma && (
               <div className="fixed inset-0 bg-white md:bg-black/60 flex items-start justify-center md:p-4 z-[100] overflow-y-auto">
                 <div className="bg-white p-0 md:rounded-xl w-full max-w-4xl shadow-2xl flex flex-col my-0 md:my-8 relative print-section">
                    <div className="sticky top-0 z-20 p-5 border-b bg-emerald-50 flex justify-between items-center no-print shadow-sm md:rounded-t-xl">
                        <div className="flex items-center"><Building2 className="w-8 h-8 mr-3 text-emerald-600" /><div><h3 className="font-bold text-gray-800 text-lg leading-tight">{summaryFirma}</h3><p className="text-xs text-emerald-700 font-bold">Müşteri Ekstresi ve Raporu</p></div></div>
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center text-sm font-bold hover:bg-emerald-700 shadow-md"><Printer className="w-4 h-4 mr-2"/> Yazdır</button>
                            <button onClick={()=>setSummaryFirma(null)} className="bg-white border border-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5"/></button>
                        </div>
                    </div>
                    <div id="print-firma" className="p-6 flex-1 overflow-auto bg-white md:rounded-b-xl">
                        <div className="print-only-header" style={{ display: 'none' }}>
                            <div className="print-title">DFN Ormancılık Müşteri Ekstresi</div>
                            <div className="print-subtitle">Proje: {project.isim} | Müşteri: {summaryFirma} | Tarih: {formatDate(new Date().toISOString().split('T')[0])}</div>
                        </div>
                        {(() => {
                            const ledger = getFirmaLedger(summaryFirma);
                            const fTonaj = ledger.reduce((s, row) => s + (parseFloat(row.tonaj)||0), 0);
                            const fSatis = ledger.reduce((s, row) => s + row.hakedis, 0);
                            const fAlinan = ledger.reduce((s, row) => s + row.odenen, 0);
                            const fBakiye = fSatis - fAlinan;
                            return (
                                <>
                                <div className="print-summary grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="print-summary-box bg-gray-50 p-3 rounded-lg border text-center"><span className="block text-xs text-gray-500 font-bold">Toplam Sefer</span><span className="text-lg font-black">{ledger.length}</span></div>
                                    <div className="print-summary-box bg-gray-50 p-3 rounded-lg border text-center"><span className="block text-xs text-gray-500 font-bold">Toplam Teslimat</span><span className="text-lg font-black text-blue-600">{fTonaj.toFixed(2)} t</span></div>
                                    <div className="print-summary-box bg-emerald-50 p-3 rounded-lg border text-center"><span className="block text-xs text-emerald-700 font-bold">Alınan Tahsilat</span><span className="text-lg font-black text-emerald-600">{fAlinan.toLocaleString('tr-TR')} ₺</span></div>
                                    <div className="print-summary-box bg-red-50 p-3 rounded-lg border text-center"><span className="block text-xs text-red-800 font-bold">Kalan Borcu</span><span className="text-xl font-black text-red-600">{fBakiye.toLocaleString('tr-TR')} ₺</span></div>
                                </div>
                                <table className="print-table w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-100 border-b">
                                        <tr><th className="p-2 border">Tarih</th><th className="p-2 border">İşlem Detayı</th><th className="p-2 border text-right">Tonaj</th><th className="p-2 border text-right">Nak. B.Fiyat</th><th className="p-2 border text-right">Net Hakediş</th><th className="p-2 border text-right text-purple-700">Ödenen (Nakit)</th><th className="p-2 border text-right text-red-600">Bakiye</th></tr>
                                    </thead>
                                    <tbody>
                                        {ledger.length === 0 ? (
                                            <tr><td colSpan="7" className="p-4 text-center">Kayıt yok.</td></tr>
                                        ) : (
                                            ledger.map((row, i) => (
                                                <tr key={i} className="border-b">
                                                    <td className="p-2 border">{formatDate(row.tarih)}</td>
                                                    <td className="p-2 border font-bold text-gray-700">{row.islem + (row.firma ? ` (${row.firma})` : '')}</td>
                                                    <td className="p-2 border text-right font-bold">{row.tonaj > 0 ? parseFloat(row.tonaj).toFixed(2) : '-'}</td><td className="p-2 border text-right">{row.bf > 0 ? row.bf : '-'}</td>
                                                    <td className="p-2 border text-right font-bold text-gray-800">{row.hakedis > 0 ? row.hakedis.toLocaleString('tr-TR')+' ₺' : '-'}</td>
                                                    <td className="p-2 border text-right font-bold text-purple-600">{row.odenen > 0 ? row.odenen.toLocaleString('tr-TR')+' ₺' : '-'}</td>
                                                    <td className="p-2 border text-right font-black">{row.bakiye.toLocaleString('tr-TR')} ₺</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                </>
                            );
                        })()}
                    </div>
                 </div>
               </div>
            )}

            {/* 2. KESİMCİ CARİ (HESAP) EKSTRESİ MODALI */}
            {summaryKesimci && (
               <div className="fixed inset-0 bg-white md:bg-black/60 flex items-start justify-center md:p-4 z-[100] overflow-y-auto">
                 <div className="bg-white p-0 md:rounded-xl w-full max-w-4xl shadow-2xl flex flex-col my-0 md:my-8 relative print-section">
                    <div className="sticky top-0 z-20 p-5 border-b bg-orange-50 flex justify-between items-center no-print shadow-sm md:rounded-t-xl">
                        <div className="flex items-center"><Users className="w-8 h-8 mr-3 text-orange-600" /><div><h3 className="font-bold text-gray-800 text-lg leading-tight">{summaryKesimci}</h3><p className="text-xs text-orange-700 font-bold">Kesimci Cari Ekstresi</p></div></div>
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center text-sm font-bold hover:bg-orange-700 shadow-md"><Printer className="w-4 h-4 mr-2"/> Yazdır</button>
                            <button onClick={()=>setSummaryKesimci(null)} className="bg-white border border-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5"/></button>
                        </div>
                    </div>
                    <div id="print-kesimci" className="p-6 flex-1 overflow-auto bg-white md:rounded-b-xl">
                        <div className="print-only-header" style={{ display: 'none' }}>
                            <div className="print-title">DFN Ormancılık Kesimci Cari Ekstresi</div>
                            <div className="print-subtitle">Proje: {project.isim} | Kesimci: {summaryKesimci} | Tarih: {formatDate(new Date().toISOString().split('T')[0])}</div>
                        </div>
                        {(() => {
                            const ledger = getKesimciLedger(summaryKesimci);
                            const totalTonaj = ledger.reduce((s, row) => s + row.tonaj, 0);
                            const totalHakedis = ledger.reduce((s, row) => s + row.hakedis, 0);
                            const totalOdenen = ledger.reduce((s, row) => s + row.odenen, 0);
                            const bakiye = totalHakedis - totalOdenen;
                            return (
                                <>
                                <div className="print-summary grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="print-summary-box bg-gray-50 p-3 rounded-lg border text-center"><span className="block text-xs text-gray-500 font-bold">Toplam Kesim</span><span className="text-lg font-black text-blue-600">{totalTonaj.toFixed(2)} t</span></div>
                                    <div className="print-summary-box bg-gray-50 p-3 rounded-lg border text-center"><span className="block text-xs text-gray-500 font-bold">Toplam Hakediş</span><span className="text-lg font-black text-gray-800">{totalHakedis.toLocaleString('tr-TR')} ₺</span></div>
                                    <div className="print-summary-box bg-emerald-50 p-3 rounded-lg border text-center"><span className="block text-xs text-emerald-700 font-bold">Yapılan Ödemeler</span><span className="text-lg font-black text-emerald-600">{totalOdenen.toLocaleString('tr-TR')} ₺</span></div>
                                    <div className="print-summary-box bg-red-50 p-3 rounded-lg border text-center"><span className="block text-xs text-red-800 font-bold">İçerideki Parası</span><span className="text-xl font-black text-red-600">{bakiye.toLocaleString('tr-TR')} ₺</span></div>
                                </div>
                                <table className="print-table w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-100 border-b">
                                        <tr><th className="p-2 border">Tarih</th><th className="p-2 border">İşlem Açıklaması</th><th className="p-2 border text-right">Tonaj</th><th className="p-2 border text-right">Hakediş (Alacak)</th><th className="p-2 border text-right text-emerald-600">Ödenen (Nakit)</th><th className="p-2 border text-right text-red-600">Bakiye</th></tr>
                                    </thead>
                                    <tbody>
                                        {ledger.length === 0 ? (
                                            <tr><td colSpan="6" className="p-4 text-center">Kayıt yok.</td></tr>
                                        ) : (
                                            ledger.map((row, i) => (
                                                <tr key={i} className="border-b">
                                                    <td className="p-2 border">{formatDate(row.tarih)}</td><td className="p-2 border font-bold text-gray-700">{row.islem}</td>
                                                    <td className="p-2 border text-right">{row.tonaj > 0 ? row.tonaj.toFixed(2) : '-'}</td>
                                                    <td className="p-2 border text-right font-bold">{row.hakedis > 0 ? row.hakedis.toLocaleString('tr-TR')+' ₺' : '-'}</td>
                                                    <td className="p-2 border text-right font-bold text-emerald-600">{row.odenen > 0 ? row.odenen.toLocaleString('tr-TR')+' ₺' : '-'}</td>
                                                    <td className="p-2 border text-right font-black">{row.bakiye.toLocaleString('tr-TR')} ₺</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                </>
                            );
                        })()}
                    </div>
                 </div>
               </div>
            )}

            {/* 3. PLAKA (NAKLİYECİ) RAPOR MODALI */}
            {summaryPlaka && (
               <div className="fixed inset-0 bg-white md:bg-black/60 flex items-start justify-center md:p-4 z-[100] overflow-y-auto">
                 <div className="bg-white p-0 md:rounded-xl w-full max-w-4xl shadow-2xl flex flex-col my-0 md:my-8 relative print-section">
                    <div className="sticky top-0 z-20 p-5 border-b bg-purple-50 flex justify-between items-center no-print shadow-sm md:rounded-t-xl">
                        <div className="flex items-center"><Truck className="w-8 h-8 mr-3 text-purple-600" /><div><h3 className="font-bold text-gray-800 text-lg leading-tight">{summaryPlaka}</h3><p className="text-xs text-purple-700 font-bold">Araç Nakliye Seferleri ve Ödemeleri</p></div></div>
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center text-sm font-bold hover:bg-purple-700 shadow-md"><Printer className="w-4 h-4 mr-2"/> Yazdır</button>
                            <button onClick={()=>setSummaryPlaka(null)} className="bg-white border border-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5"/></button>
                        </div>
                    </div>
                    <div id="print-plaka" className="p-6 flex-1 overflow-auto bg-white md:rounded-b-xl">
                        <div className="print-only-header" style={{ display: 'none' }}>
                            <div className="print-title">DFN Ormancılık Araç Nakliye Raporu</div>
                            <div className="print-subtitle">Proje: {project.isim} | Araç Plakası: {summaryPlaka} | Tarih: {formatDate(new Date().toISOString().split('T')[0])}</div>
                        </div>
                        {(() => {
                            const ledger = getPlakaLedger(summaryPlaka);
                            const pTonaj = ledger.reduce((s, row) => s + (parseFloat(row.tonaj)||0), 0);
                            const pHakedis = ledger.reduce((s, row) => s + row.hakedis, 0);
                            const pOdenen = ledger.reduce((s, row) => s + row.odenen, 0);
                            const pBakiye = pHakedis - pOdenen;
                            return (
                                <>
                                <div className="print-summary grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="print-summary-box bg-gray-50 p-3 rounded-lg border text-center"><span className="block text-xs text-gray-500 font-bold">Toplam Sefer</span><span className="text-lg font-black">{ledger.filter(l=>l.tonaj > 0).length}</span></div>
                                    <div className="print-summary-box bg-gray-50 p-3 rounded-lg border text-center"><span className="block text-xs text-gray-500 font-bold">Taşıdığı Tonaj</span><span className="text-lg font-black text-blue-600">{pTonaj.toFixed(2)} t</span></div>
                                    <div className="print-summary-box bg-purple-50 p-3 rounded-lg border text-center"><span className="block text-xs text-purple-700 font-bold">Nakliye Hakedişi (Net)</span><span className="text-lg font-black text-purple-800">{pHakedis.toLocaleString('tr-TR')} ₺</span></div>
                                    <div className="print-summary-box bg-red-50 p-3 rounded-lg border text-center"><span className="block text-xs text-red-800 font-bold">Araca Kalan Borç</span><span className="text-xl font-black text-red-600">{pBakiye.toLocaleString('tr-TR')} ₺</span></div>
                                </div>
                                <table className="print-table w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-100 border-b">
                                        <tr><th className="p-2 border">Tarih</th><th className="p-2 border">İşlem Detayı</th><th className="p-2 border text-right">Tonaj</th><th className="p-2 border text-right">Nak. B.Fiyat</th><th className="p-2 border text-right">Net Hakediş</th><th className="p-2 border text-right text-purple-700">Ödenen (Nakit)</th><th className="p-2 border text-right text-red-600">Bakiye</th></tr>
                                    </thead>
                                    <tbody>
                                        {ledger.length === 0 ? (
                                            <tr><td colSpan="7" className="p-4 text-center">Kayıt yok.</td></tr>
                                        ) : (
                                            ledger.map((row, i) => (
                                                <tr key={i} className="border-b">
                                                    <td className="p-2 border">{formatDate(row.tarih)}</td>
                                                    <td className="p-2 border font-bold text-gray-700">{row.islem + (row.firma ? ` (${row.firma})` : '')}</td>
                                                    <td className="p-2 border text-right font-bold">{row.tonaj > 0 ? parseFloat(row.tonaj).toFixed(2) : '-'}</td><td className="p-2 border text-right">{row.bf > 0 ? row.bf : '-'}</td>
                                                    <td className="p-2 border text-right font-bold text-gray-800">{row.hakedis > 0 ? row.hakedis.toLocaleString('tr-TR')+' ₺' : '-'}</td>
                                                    <td className="p-2 border text-right font-bold text-purple-600">{row.odenen > 0 ? row.odenen.toLocaleString('tr-TR')+' ₺' : '-'}</td>
                                                    <td className="p-2 border text-right font-black">{row.bakiye.toLocaleString('tr-TR')} ₺</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                                </>
                            );
                        })()}
                    </div>
                 </div>
               </div>
            )}

            {/* 4. SAHA GENEL DÖKÜM (ÖZET RAPOR) MODALI */}
            {showGenelRapor && (
               <div className="fixed inset-0 bg-white md:bg-black/60 flex items-start justify-center md:p-4 z-[100] overflow-y-auto">
                 <div className="bg-white p-0 md:rounded-xl w-full max-w-3xl shadow-2xl flex flex-col my-0 md:my-8 relative print-section">
                    <div className="sticky top-0 z-20 p-5 border-b bg-gray-800 text-white flex justify-between items-center no-print shadow-sm md:rounded-t-xl">
                        <div className="flex items-center"><PieChart className="w-6 h-6 mr-3 text-gray-300" /><div><h3 className="font-bold text-lg leading-tight">Saha Genel Döküm Raporu</h3><p className="text-xs text-gray-400 font-bold">Tüm Maliyet ve Satış Özeti</p></div></div>
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center text-sm font-bold hover:bg-emerald-500 shadow-md"><Printer className="w-4 h-4 mr-2"/> Yazdır</button>
                            <button onClick={()=>setShowGenelRapor(false)} className="bg-gray-700 text-white p-2 rounded-lg hover:bg-gray-600"><X className="w-5 h-5"/></button>
                        </div>
                    </div>
                    <div id="print-genel" className="p-8 flex-1 overflow-auto bg-white md:rounded-b-xl">
                        <div className="print-title mb-1 text-center text-2xl border-b pb-4">{project.isim} - Genel Döküm</div>
                        <div className="print-subtitle text-center mb-8">Rapor Tarihi: {formatDate(new Date().toISOString().split('T')[0])}</div>
                        
                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div className="border border-gray-300 p-4 rounded text-sm">
                                <h4 className="font-black border-b border-gray-200 pb-2 mb-3 text-emerald-800">SATIŞ VE GELİRLER</h4>
                                <div className="flex justify-between mb-2"><span>Odun Çıkışı:</span> <span className="font-bold">{gerOdunTon.toFixed(2)} Ton</span></div>
                                <div className="flex justify-between mb-2"><span>Odun Hasılat:</span> <span className="font-bold">{gerOdunCiro.toLocaleString('tr-TR')} ₺</span></div>
                                <div className="flex justify-between mb-2"><span>Tomruk Çıkışı:</span> <span className="font-bold">{gerTomrukTon.toFixed(2)} Ton</span></div>
                                <div className="flex justify-between mb-2 border-b border-gray-200 pb-2"><span>Tomruk Hasılat:</span> <span className="font-bold">{gerTomrukCiro.toLocaleString('tr-TR')} ₺</span></div>
                                <div className="flex justify-between text-base mt-2"><span className="font-black">TOPLAM GELİR:</span> <span className="font-black text-emerald-600">{gerGelir.toLocaleString('tr-TR')} ₺</span></div>
                            </div>
                            <div className="border border-gray-300 p-4 rounded text-sm">
                                <h4 className="font-black border-b border-gray-200 pb-2 mb-3 text-red-800">MALİYET VE GİDERLER</h4>
                                <div className="flex justify-between mb-2"><span>OGM Fatura:</span> <span className="font-bold">{(parseFloat(settings.ogmMatrah)||0).toLocaleString('tr-TR')} ₺</span></div>
                                <div className="flex justify-between mb-2"><span>Kesim Maliyeti:</span> <span className="font-bold">{gerKesimGideri.toLocaleString('tr-TR')} ₺</span></div>
                                <div className="flex justify-between mb-2"><span>Nakliye Maliyeti:</span> <span className="font-bold">{gerNakliyeGideri.toLocaleString('tr-TR')} ₺</span></div>
                                <div className="flex justify-between mb-2 border-b border-gray-200 pb-2"><span>Diğer Giderler:</span> <span className="font-bold">{toplamDigerGider.toLocaleString('tr-TR')} ₺</span></div>
                                <div className="flex justify-between text-base mt-2"><span className="font-black">TOPLAM GİDER:</span> <span className="font-black text-red-600">{gerGider.toLocaleString('tr-TR')} ₺</span></div>
                            </div>
                        </div>

                        <div className="border-4 border-gray-100 p-6 rounded-xl text-center mb-8 bg-gray-50 print-summary-box">
                            <h3 className="text-xl font-bold mb-2">PROJE KAR / ZARAR DURUMU</h3>
                            <div className="text-3xl font-black text-gray-800 mb-2">BRÜT: {gerKdvHaricKar >= 0 ? '+' : ''}{gerKdvHaricKar.toLocaleString('tr-TR')} ₺</div>
                            <div className="text-lg font-bold text-gray-500">RESMİ (%25 GV Düşülmüş): {gerNetKar >= 0 ? '+' : ''}{gerNetKar.toLocaleString('tr-TR')} ₺</div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center border-t pt-6 text-sm print-summary">
                            <div className="print-summary-box"><div className="text-gray-500 font-bold mb-1">Müşteriden Alınan</div><div className="font-black text-blue-600 text-lg">{gerTahsilEdilen.toLocaleString('tr-TR')} ₺</div></div>
                            <div className="print-summary-box"><div className="text-gray-500 font-bold mb-1">Kesimciye Ödenen</div><div className="font-black text-orange-600 text-lg">{gerKesimOdenen.toLocaleString('tr-TR')} ₺</div></div>
                            <div className="print-summary-box"><div className="text-gray-500 font-bold mb-1">Nakliyeciye Ödenen</div><div className="font-black text-purple-600 text-lg">{gerNakliyeOdenen.toLocaleString('tr-TR')} ₺</div></div>
                            <div className="print-summary-box"><div className="text-gray-500 font-bold mb-1">Serbest Nakit (Kasa)</div><div className="font-black text-black text-lg">{(gerTahsilEdilen - gerKesimOdenen - gerNakliyeOdenen - toplamDigerGider).toLocaleString('tr-TR')} ₺</div></div>
                        </div>
                    </div>
                 </div>
               </div>
            )}

            {deleteModal && (
               <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] animate-fade-in no-print">
                   <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                       <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center"><Trash2 className="w-5 h-5 mr-2 text-red-600" /> Silme Onayı</h3>
                       <p className="text-gray-600 mb-6 font-medium">{deleteModal.confirmMsg}</p>
                       <div className="flex justify-end gap-3">
                           <button onClick={() => setDeleteModal(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100 font-bold text-gray-700">İptal</button>
                           <button onClick={confirmDeleteAction} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-md">Evet, Sil</button>
                       </div>
                   </div>
               </div>
            )}

        </div>
    );
}

// ----------------------------------------------------------------------
// MODÜL 2: TAPULU KESİM İŞ TAKİBİ
// ----------------------------------------------------------------------
function TapuluKesimTakip({ user, db, appId, showToast }) {
  const [jobs, setJobs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [summaryCustomer, setSummaryCustomer] = useState(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [deleteModalId, setDeleteModalId] = useState(null);

  const [prices, setPrices] = useState({ dosyaTaban: 10800, dosyaM3: 108, kademe1: 1200, kademe2: 2200, kademe3: 4100, kademe4: 5100 });
  
  const initialForm = {
    yil: new Date().getFullYear().toString(),
    isletmeMudurlugu: '', isletmeSefligi: '', mahalleKoy: '', adaParsel: '', musteriAdi: '',
    arazi: false, durumu: 'EVRAK LİSTESİ', muracatTarihi: '', onayTarihi: '', basvuruNumarasi: '',
    dkgh: '', agacCinsi: '', dosyaParasi: '', isletmeyeYatacak: '', soylenen: '', alinanUcret: '', toplam: '', kalanUcret: ''
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (!user || !db) return;
    const unsubJobs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'tapulu_kesim_jobs'), (snap) => {
      setJobs(snap.docs.map(d => d.data()).sort((a, b) => (a.siraNo || 0) - (b.siraNo || 0)));
    });
    const unsubPrices = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'tk_prices'), (docSnap) => {
      if (docSnap.exists()) setPrices(docSnap.data());
    });
    return () => { unsubJobs(); unsubPrices(); };
  }, [user, db, appId]);

  const uniqueMudurluk = useMemo(() => [...new Set(jobs.map(j => j.isletmeMudurlugu).filter(Boolean))], [jobs]);
  const uniqueSeflik = useMemo(() => [...new Set(jobs.map(j => j.isletmeSefligi).filter(Boolean))], [jobs]);
  const uniqueKoy = useMemo(() => [...new Set(jobs.map(j => j.mahalleKoy).filter(Boolean))], [jobs]);
  const uniqueMusteri = useMemo(() => [...new Set(jobs.map(j => j.musteriAdi).filter(Boolean))], [jobs]);
  const uniqueCins = useMemo(() => [...new Set(jobs.map(j => j.agacCinsi).filter(Boolean))], [jobs]);

  const years = useMemo(() => {
      const y = new Set(jobs.map(j => j.yil || new Date().getFullYear().toString()));
      return ['Tümü', ...Array.from(y).sort().reverse()];
  }, [jobs]);
  
  const [selectedYear, useStateYear] = useState('Tümü');
  
  const filteredJobs = useMemo(() => {
      if (useStateYear === 'Tümü') return jobs;
      return jobs.filter(j => (j.yil || new Date().getFullYear().toString()) === useStateYear);
  }, [jobs, useStateYear]);

  const totalMuracaat = filteredJobs.length;
  const onaylananDosya = filteredJobs.filter(j => ['ONAYLANDI', 'BİTTİ'].includes((j.durumu||'').toUpperCase())).length;
  const totalSoylenen = filteredJobs.reduce((s, j) => s + (parseFloat(j.soylenen) || 0), 0);
  const totalAlinan = filteredJobs.reduce((s, j) => s + (parseFloat(j.alinanUcret) || 0), 0);
  const totalKalan = filteredJobs.reduce((s, j) => s + (parseFloat(j.kalanUcret) || 0), 0);

  const handleDkghChange = (valStr) => {
    const dkghVal = parseFloat(valStr) || 0;
    let isletme = '';
    let dosya = '';

    if (dkghVal > 0) {
        if (dkghVal <= 20) isletme = prices.kademe1;
        else if (dkghVal <= 50) isletme = prices.kademe2;
        else if (dkghVal <= 100) isletme = prices.kademe3;
        else isletme = prices.kademe4;

        dosya = Math.round(prices.dosyaTaban + (dkghVal * prices.dosyaM3));
    }

    const soylenen = parseFloat(formData.soylenen) || 0;
    const alinan = parseFloat(formData.alinanUcret) || 0;
    const toplam = (parseFloat(dosya)||0) + (parseFloat(isletme)||0);
    const kalan = soylenen - alinan;

    setFormData(prev => ({
        ...prev,
        dkgh: valStr,
        isletmeyeYatacak: isletme,
        dosyaParasi: dosya,
        toplam: toplam,
        kalanUcret: kalan
    }));
  };

  const handleOpenAdd = () => { setFormData(initialForm); setEditingId(null); setShowModal(true); };
  const handleOpenEdit = (job) => { setFormData(job); setEditingId(job.id); setShowModal(true); };
  
  const handleDelete = (id) => { setDeleteModalId(id); };

  const confirmDeleteAction = async () => { 
      if(user && db && deleteModalId) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tapulu_kesim_jobs', deleteModalId));
          setDeleteModalId(null);
          showToast("Kayıt başarıyla silindi.");
      }
  };

  const handleSavePrices = async () => {
     if (user && db) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'tk_prices'), prices);
        showToast("Birim fiyat ayarları ve formüller güncellendi!");
        setShowPriceModal(false);
     }
  };

  const handleSave = async () => {
    const dosya = parseFloat(formData.dosyaParasi) || 0;
    const isletme = parseFloat(formData.isletmeyeYatacak) || 0;
    const toplam = dosya + isletme;
    const soylenen = parseFloat(formData.soylenen) || 0;
    const alinan = parseFloat(formData.alinanUcret) || 0;
    const kalanUcret = soylenen - alinan;

    let siraNo = formData.siraNo;
    if (!editingId) {
        const maxSira = jobs.reduce((max, job) => Math.max(max, job.siraNo || 0), 0);
        siraNo = maxSira + 1;
    }

    const jobData = { ...formData, siraNo, dosyaParasi: dosya, isletmeyeYatacak: isletme, toplam, soylenen, alinanUcret: alinan, kalanUcret, id: editingId || `tk_${Date.now()}` };
    
    if (user && db) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tapulu_kesim_jobs', jobData.id), jobData);
      setShowModal(false); showToast("Kayıt başarıyla kaydedildi!");
    }
  };

  const getStatusColor = (durum) => {
    const d = (durum||'').toLowerCase();
    if (d.includes('onay')) return 'bg-emerald-100 text-emerald-800';
    if (d.includes('bitti')) return 'bg-teal-100 text-teal-800';
    if (d.includes('şefte')) return 'bg-blue-100 text-blue-800';
    if (d.includes('kontrol')) return 'bg-orange-100 text-orange-800';
    if (d.includes('evrak')) return 'bg-purple-100 text-purple-800';
    if (d.includes('iptal')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4 flex flex-col h-full animate-fade-in print-section overflow-y-auto custom-scrollbar pb-8 pr-1">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print shrink-0">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Tapulu Kesim Dosyaları</h2>
           <p className="text-sm text-gray-500">Maliyetleriniz DKGH girildiğinde otomatik hesaplanır.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2.5 rounded-lg flex items-center shadow-md text-sm font-bold">
            <Printer className="w-4 h-4 mr-2" /> Yazdır
          </button>
          <button onClick={() => setShowPriceModal(true)} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg flex items-center shadow-md text-sm font-bold">
            <Settings className="w-4 h-4 mr-2" /> Formül Ayarları
          </button>
          <button onClick={handleOpenAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg flex items-center shadow-md text-sm font-bold">
            <Plus className="w-4 h-4 mr-1" /> Yeni Kayıt
          </button>
        </div>
      </div>

      <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex overflow-x-auto custom-scrollbar no-print shrink-0">
        {years.map(y => (
            <button key={y} onClick={() => useStateYear(y)} className={`px-5 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-colors ${useStateYear === y ? 'bg-emerald-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                {y === 'Tümü' ? 'Tüm Yıllar' : `${y} Yılı Dosyaları`}
            </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 no-print shrink-0 mb-1 mt-1">
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 font-bold">Toplam Müracaat</p><p className="text-xl font-black text-gray-800">{totalMuracaat} Adet</p></div>
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 font-bold">Onaylanan Dosya</p><p className="text-xl font-black text-emerald-600">{onaylananDosya} Adet</p></div>
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 font-bold">Toplam İşlem Tutarı</p><p className="text-xl font-black text-blue-600">{totalSoylenen.toLocaleString('tr-TR')} ₺</p></div>
         <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm"><p className="text-xs text-emerald-700 font-bold">Tahsil Edilen (Alınan)</p><p className="text-xl font-black text-emerald-600">{totalAlinan.toLocaleString('tr-TR')} ₺</p></div>
         <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/30 shadow-sm"><p className="text-xs text-red-700 font-bold">Kalan Alacak</p><p className="text-xl font-black text-red-600">{totalKalan.toLocaleString('tr-TR')} ₺</p></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-[400px]">
        <div className="overflow-auto flex-1 custom-scrollbar relative">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[2000px] print-table">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs uppercase font-bold sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="p-3 w-12 text-center bg-gray-50">Sıra No</th>
                <th className="p-3 bg-gray-50">İşletme Müdürlüğü</th>
                <th className="p-3 bg-gray-50">İşletme Şefliği</th>
                <th className="p-3 bg-gray-50">Mahalle/ Köy</th>
                <th className="p-3 bg-gray-50">Ada/ Parsel</th>
                <th className="p-3 bg-gray-50 text-emerald-800">Müracat Sahibinin Adı Soyadı</th>
                <th className="p-3 text-center bg-gray-50">Arazi</th>
                <th className="p-3 bg-gray-50">DURUMU</th>
                <th className="p-3 bg-gray-50">Müracat Tarihi</th>
                <th className="p-3 bg-gray-50">Onay Tarihi</th>
                <th className="p-3 bg-gray-50">Başvuru Numarası</th>
                <th className="p-3 text-right bg-blue-50/90">DKGH</th>
                <th className="p-3 text-center bg-gray-50">Ağaç Cinsi</th>
                <th className="p-3 text-right border-l border-gray-200 text-red-800 bg-red-50/50">Dosya Parası</th>
                <th className="p-3 text-right text-red-800 bg-red-50/50">İşletmeye Yatacak</th>
                <th className="p-3 text-right font-black text-red-600 bg-red-100/80">TOPLAM</th>
                <th className="p-3 text-right border-l border-gray-200 text-emerald-800 bg-emerald-50/50">Söylenen</th>
                <th className="p-3 text-right text-emerald-800 bg-emerald-50/50">Alınan Ücret</th>
                <th className="p-3 text-right font-black text-orange-600 bg-orange-100/80">Kalan Ücret</th>
                <th className="p-3 text-center border-l border-gray-200 sticky right-0 z-30 bg-gray-100 no-print shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]">İşlem</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {filteredJobs.length === 0 ? (
                <tr><td colSpan="20" className="p-8 text-center text-gray-500">Bu yıla ait kayıt bulunamadı.</td></tr>
              ) : (
                filteredJobs.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-3 text-center font-bold text-gray-400">{job.siraNo || '-'}</td>
                    <td className="p-3 font-medium text-gray-700">{job.isletmeMudurlugu}</td>
                    <td className="p-3 text-gray-700">{job.isletmeSefligi}</td>
                    <td className="p-3 text-gray-700">{job.mahalleKoy}</td>
                    <td className="p-3 font-bold">{job.adaParsel}</td>
                    <td className="p-3 font-bold text-emerald-800">
                        <button onClick={() => setSummaryCustomer(job.musteriAdi)} className="hover:underline flex items-center"><Users className="w-3 h-3 mr-1"/>{job.musteriAdi}</button>
                    </td>
                    <td className="p-3 text-center">{job.arazi ? <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" /> : '-'}</td>
                    <td className="p-3"><span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded border ${getStatusColor(job.durumu)}`}>{job.durumu}</span></td>
                    <td className="p-3 text-gray-500">{job.muracatTarihi ? formatDate(job.muracatTarihi) : '-'}</td>
                    <td className="p-3 text-gray-500 font-bold">{job.onayTarihi ? formatDate(job.onayTarihi) : '-'}</td>
                    <td className="p-3 text-gray-500 font-mono">{job.basvuruNumarasi || '-'}</td>
                    <td className="p-3 text-right font-black text-blue-700 bg-blue-50/20">{job.dkgh}</td>
                    <td className="p-3 text-center"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-bold">{job.agacCinsi}</span></td>
                    
                    <td className="p-3 text-right border-l border-gray-100 text-red-700 bg-red-50/10">{job.dosyaParasi > 0 ? job.dosyaParasi.toLocaleString('tr-TR') : '-'}</td>
                    <td className="p-3 text-right text-red-700 bg-red-50/10">{job.isletmeyeYatacak > 0 ? job.isletmeyeYatacak.toLocaleString('tr-TR') : '-'}</td>
                    <td className="p-3 text-right font-black text-red-600 bg-red-50/30">{job.toplam > 0 ? job.toplam.toLocaleString('tr-TR') : '-'}</td>
                    
                    <td className="p-3 text-right border-l border-gray-100 font-bold text-emerald-700 bg-emerald-50/10">{job.soylenen > 0 ? job.soylenen.toLocaleString('tr-TR') : '-'}</td>
                    <td className="p-3 text-right font-bold text-emerald-600 bg-emerald-50/10">{job.alinanUcret > 0 ? job.alinanUcret.toLocaleString('tr-TR') : '-'}</td>
                    <td className="p-3 text-right font-black text-orange-600 bg-orange-50/30">{job.kalanUcret > 0 ? job.kalanUcret.toLocaleString('tr-TR') : (job.kalanUcret === 0 && job.soylenen > 0 ? 'Ödendi' : '-')}</td>
                    
                    <td className="p-3 text-center border-l border-gray-200 sticky right-0 z-10 bg-white group-hover:bg-gray-50 no-print shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] transition-colors">
                       <div className="flex items-center justify-center gap-2">
                         <button onClick={() => handleOpenEdit(job)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"><Pencil className="w-4 h-4"/></button>
                         <button onClick={() => handleDelete(job.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formül / Birim Fiyat Ayarları Modalı */}
      {showPriceModal && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-start justify-center p-4 pt-10 animate-fade-in no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-gray-800 flex items-center"><Settings className="w-5 h-5 mr-2 text-gray-600" /> Formül / Birim Fiyat Ayarları</h3>
              <button onClick={() => setShowPriceModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-700" /></button>
            </div>
            <div className="p-5 space-y-4">
               <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 font-medium">Bu rakamları değiştirdiğinizde, yeni ekleyeceğiniz veya düzenleyeceğiniz kayıtlarda DKGH yazınca otomatik bu formüller çalışır.</div>
               <div>
                 <p className="font-bold text-sm text-gray-700 mb-2 border-b pb-1">1) Dosya Parası Formülü</p>
                 <div className="flex gap-4">
                   <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">Sabit Taban (₺)</label><input type="number" className="w-full p-2 border rounded font-bold" value={prices.dosyaTaban} onChange={e => setPrices({...prices, dosyaTaban: parseFloat(e.target.value)||0})} /></div>
                   <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">m³ Başına Çarpan (₺)</label><input type="number" className="w-full p-2 border rounded font-bold" value={prices.dosyaM3} onChange={e => setPrices({...prices, dosyaM3: parseFloat(e.target.value)||0})} /></div>
                 </div>
               </div>
               <div>
                 <p className="font-bold text-sm text-gray-700 mb-2 border-b pb-1 mt-4">2) İşletmeye Yatacak Kademeleri (₺)</p>
                 <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-xs text-gray-500 mb-1">0 - 20 m³ Arası</label><input type="number" className="w-full p-2 border rounded font-bold" value={prices.kademe1} onChange={e => setPrices({...prices, kademe1: parseFloat(e.target.value)||0})} /></div>
                   <div><label className="block text-xs text-gray-500 mb-1">20 - 50 m³ Arası</label><input type="number" className="w-full p-2 border rounded font-bold" value={prices.kademe2} onChange={e => setPrices({...prices, kademe2: parseFloat(e.target.value)||0})} /></div>
                   <div><label className="block text-xs text-gray-500 mb-1">50 - 100 m³ Arası</label><input type="number" className="w-full p-2 border rounded font-bold" value={prices.kademe3} onChange={e => setPrices({...prices, kademe3: parseFloat(e.target.value)||0})} /></div>
                   <div><label className="block text-xs text-gray-500 mb-1">100 m³ Üzeri</label><input type="number" className="w-full p-2 border rounded font-bold" value={prices.kademe4} onChange={e => setPrices({...prices, kademe4: parseFloat(e.target.value)||0})} /></div>
                 </div>
               </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowPriceModal(false)} className="px-4 py-2 border bg-white rounded-lg text-sm font-bold">İptal</button>
              <button onClick={handleSavePrices} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-bold flex items-center hover:bg-black"><Save className="w-4 h-4 mr-1"/> Formülleri Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-start justify-center p-4 pt-10 overflow-y-auto no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col my-8 animate-fade-in">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <Trees className="w-6 h-6 mr-2 text-emerald-600" /> {editingId ? 'Kayıt Düzenle' : 'Yeni Tapulu Kesim İşi Ekle'}
              </h3>
              <button onClick={() => setShowModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-gray-700" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">İşletme Müdürlüğü</label>
                    <input type="text" list="list-mudurluk" className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 uppercase" value={formData.isletmeMudurlugu} onChange={e => setFormData({...formData, isletmeMudurlugu: e.target.value})} placeholder="Seç/Yaz" />
                    <datalist id="list-mudurluk">{uniqueMudurluk.map(i => <option key={i} value={i}/>)}</datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">İşletme Şefliği</label>
                    <input type="text" list="list-seflik" className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 uppercase" value={formData.isletmeSefligi} onChange={e => setFormData({...formData, isletmeSefligi: e.target.value})} placeholder="Seç/Yaz" />
                    <datalist id="list-seflik">{uniqueSeflik.map(i => <option key={i} value={i}/>)}</datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mahalle/ Köy</label>
                    <input type="text" list="list-koy" className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 uppercase" value={formData.mahalleKoy} onChange={e => setFormData({...formData, mahalleKoy: e.target.value})} placeholder="Seç/Yaz" />
                    <datalist id="list-koy">{uniqueKoy.map(i => <option key={i} value={i}/>)}</datalist>
                  </div>
                  
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Ada/ Parsel</label><input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 font-bold" value={formData.adaParsel} onChange={e => setFormData({...formData, adaParsel: e.target.value})} /></div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Müracat Sahibinin Adı Soyadı</label>
                    <input type="text" list="list-musteri" className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-900 uppercase" value={formData.musteriAdi} onChange={e => setFormData({...formData, musteriAdi: e.target.value})} placeholder="Müşteri Adını Seç veya Yaz"/>
                    <datalist id="list-musteri">{uniqueMusteri.map(i => <option key={i} value={i}/>)}</datalist>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Kayıt Yılı</label>
                    <select className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 font-bold bg-gray-50" value={formData.yil || new Date().getFullYear().toString()} onChange={e => setFormData({...formData, yil: e.target.value})}>
                       {Array.from({length: 10}, (_, i) => new Date().getFullYear() - 5 + i).reverse().map(y => <option key={y} value={y.toString()}>{y}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center mt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer" checked={formData.arazi} onChange={e => setFormData({...formData, arazi: e.target.checked})} />
                      <span className="text-sm font-bold text-gray-700">Arazi Görüldü (+)</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">DURUMU</label>
                    <select className="w-full p-2 border rounded focus:ring-2 focus:ring-emerald-500 font-bold bg-gray-50" value={formData.durumu} onChange={e => setFormData({...formData, durumu: e.target.value})}>
                       <option value="EVRAK LİSTESİ">EVRAK LİSTESİ</option><option value="ŞEFTE">ŞEFTE</option><option value="KONTROL">KONTROL</option><option value="ONAYLANDI">ONAYLANDI</option><option value="BİTTİ">BİTTİ</option><option value="İPTAL">İPTAL</option>
                    </select>
                  </div>

                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Müracat Tarihi</label><input type="date" className="w-full p-2 border rounded" value={formData.muracatTarihi} onChange={e => setFormData({...formData, muracatTarihi: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Onay Tarihi</label><input type="date" className="w-full p-2 border rounded" value={formData.onayTarihi} onChange={e => setFormData({...formData, onayTarihi: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Başvuru Numarası</label><input type="text" className="w-full p-2 border rounded" value={formData.basvuruNumarasi} onChange={e => setFormData({...formData, basvuruNumarasi: e.target.value})} /></div>
                  
                  <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ağaç Cinsi</label>
                      <input type="text" list="list-cins" className="w-full p-2 border rounded font-bold uppercase" value={formData.agacCinsi} onChange={e => setFormData({...formData, agacCinsi: e.target.value})} placeholder="Seç/Yaz (ÇZ, ÇF...)" />
                      <datalist id="list-cins">{uniqueCins.map(i => <option key={i} value={i}/>)}</datalist>
                  </div>

                  <div className="md:col-span-4 bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-4 mt-2">
                    <div className="w-1/3">
                        <label className="block text-sm font-black text-blue-800 mb-1">DKGH (Hacim / m³)</label>
                        <input type="number" step="0.01" className="w-full p-3 border border-blue-300 rounded shadow-inner focus:ring-2 focus:ring-blue-500 font-black text-blue-900 text-lg" value={formData.dkgh} onChange={(e) => handleDkghChange(e.target.value)} placeholder="Burayı girin..."/>
                    </div>
                    <div className="w-2/3 text-xs text-blue-700 font-medium">
                        <p>👈 Sola <b>DKGH (Hacim)</b> verisini girdiğinizde, aşağıdaki <b className="text-red-600">Dosya Parası</b> ve <b className="text-red-600">İşletmeye Yatacak</b> alanları <b>otomatik olarak hesaplanır.</b></p>
                    </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 space-y-3">
                     <h4 className="text-sm font-black text-red-800 border-b border-red-200 pb-2">MALİYETLER (OGM)</h4>
                     <div className="flex justify-between items-center gap-2">
                       <label className="text-xs font-bold text-gray-700 w-1/2">Dosya Parası (₺)</label>
                       <input type="number" step="0.01" className="w-1/2 p-2 border border-red-200 rounded text-right text-sm outline-none font-bold bg-white" value={formData.dosyaParasi} onChange={e => {
                           const val = parseFloat(e.target.value)||0;
                           const isl = parseFloat(formData.isletmeyeYatacak)||0;
                           setFormData({...formData, dosyaParasi: e.target.value, toplam: val+isl});
                       }} />
                     </div>
                     <div className="flex justify-between items-center gap-2">
                       <label className="text-xs font-bold text-gray-700 w-1/2">İşletmeye Yatacak (₺)</label>
                       <input type="number" step="0.01" className="w-1/2 p-2 border border-red-200 rounded text-right text-sm outline-none font-bold bg-white" value={formData.isletmeyeYatacak} onChange={e => {
                           const val = parseFloat(e.target.value)||0;
                           const dosya = parseFloat(formData.dosyaParasi)||0;
                           setFormData({...formData, isletmeyeYatacak: e.target.value, toplam: dosya+val});
                       }} />
                     </div>
                     <div className="pt-2 flex justify-between items-center">
                       <span className="text-sm font-bold text-red-800">TOPLAM MALİYET:</span>
                       <span className="text-xl font-black text-red-600">
                         {((parseFloat(formData.dosyaParasi)||0) + (parseFloat(formData.isletmeyeYatacak)||0)).toLocaleString('tr-TR')} ₺
                       </span>
                     </div>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-3">
                     <h4 className="text-sm font-black text-emerald-800 border-b border-emerald-200 pb-2">TAHSİLAT DURUMU</h4>
                     <div className="flex justify-between items-center gap-2">
                       <label className="text-xs font-bold text-gray-700 w-1/2">Müşteriye Söylenen (₺)</label>
                       <input type="number" step="0.01" className="w-1/2 p-2 border border-emerald-300 rounded text-right text-sm outline-none font-bold bg-white" value={formData.soylenen} onChange={e => {
                           const val = parseFloat(e.target.value)||0;
                           const alinan = parseFloat(formData.alinanUcret)||0;
                           setFormData({...formData, soylenen: e.target.value, kalanUcret: val-alinan});
                       }} />
                     </div>
                     <div className="flex justify-between items-center gap-2">
                       <label className="text-xs font-bold text-gray-700 w-1/2">Alınan Ücret / Peşinat (₺)</label>
                       <input type="number" step="0.01" className="w-1/2 p-2 border border-emerald-400 rounded text-right text-sm outline-none font-bold text-emerald-700 bg-white" value={formData.alinanUcret} onChange={e => {
                           const val = parseFloat(e.target.value)||0;
                           const soylenen = parseFloat(formData.soylenen)||0;
                           setFormData({...formData, alinanUcret: e.target.value, kalanUcret: soylenen-val});
                       }} />
                     </div>
                     <div className="pt-2 flex justify-between items-center">
                       <span className="text-sm font-bold text-orange-800">MÜŞTERİ KALAN BORCU:</span>
                       <span className="text-xl font-black text-orange-600">
                         {((parseFloat(formData.soylenen)||0) - (parseFloat(formData.alinanUcret)||0)).toLocaleString('tr-TR')} ₺
                       </span>
                     </div>
                  </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100">İptal</button>
              <button onClick={handleSave} className="px-8 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-md">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* MÜŞTERİ CARİ ÖZETİ MODALI (TAPULU KESİM) */}
      {summaryCustomer && (
         <div className="fixed inset-0 bg-white md:bg-black/60 flex items-start justify-center md:p-4 z-[100] overflow-y-auto">
           <div className="bg-white p-0 md:rounded-xl w-full max-w-5xl shadow-2xl flex flex-col my-0 md:my-8 print-section relative">
              <div className="sticky top-0 z-20 p-5 border-b bg-emerald-50 flex justify-between items-center no-print shadow-sm md:rounded-t-xl">
                  <div className="flex items-center"><Users className="w-8 h-8 mr-3 text-emerald-600" /><div><h3 className="font-bold text-gray-800 text-lg leading-tight">{summaryCustomer}</h3><p className="text-xs text-emerald-700 font-bold">Müşteri Dosya ve Alacak Özeti</p></div></div>
                  <div className="flex gap-2">
                      <button onClick={()=>window.print()} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center text-sm font-bold hover:bg-emerald-700 shadow-md"><Printer className="w-4 h-4 mr-2"/> Yazdır</button>
                      <button onClick={()=>setSummaryCustomer(null)} className="bg-white border border-gray-300 text-gray-700 p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5"/></button>
                  </div>
              </div>
              <div className="p-6 flex-1 overflow-auto bg-white md:rounded-b-xl">
                  <div className="hidden print:block print-title">DFN Ormancılık Müşteri Dosya Özeti</div>
                  <div className="hidden print:block print-subtitle">Müşteri: {summaryCustomer} | Tarih: {formatDate(new Date().toISOString().split('T')[0])}</div>
                  {(() => {
                      const cJobs = jobs.filter(j => j.musteriAdi === summaryCustomer);
                      const tMaliyet = cJobs.reduce((sum, j) => sum + (j.toplam || 0), 0);
                      const tSoylenen = cJobs.reduce((sum, j) => sum + (j.soylenen || 0), 0);
                      const tAlinan = cJobs.reduce((sum, j) => sum + (j.alinanUcret || 0), 0);
                      const tKalan = tSoylenen - tAlinan;
                      return (
                          <>
                          <div className="print-summary grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                              <div className="print-summary-box bg-gray-50 p-3 rounded-lg border text-center"><span className="block text-xs text-gray-500 font-bold">Toplam Dosya Sayısı</span><span className="text-lg font-black">{cJobs.length} Adet</span></div>
                              <div className="print-summary-box bg-gray-50 p-3 rounded-lg border text-center"><span className="block text-xs text-gray-500 font-bold">Toplam Resmi Maliyet</span><span className="text-lg font-black text-gray-700">{tMaliyet.toLocaleString('tr-TR')} ₺</span></div>
                              <div className="print-summary-box bg-emerald-50 p-3 rounded-lg border text-center"><span className="block text-xs text-emerald-700 font-bold">Müşteriden Alınan</span><span className="text-lg font-black text-emerald-600">{tAlinan.toLocaleString('tr-TR')} ₺</span></div>
                              <div className="print-summary-box bg-red-50 p-3 rounded-lg border text-center"><span className="block text-xs text-red-800 font-bold">Kalan Borcu</span><span className="text-xl font-black text-red-600">{tKalan.toLocaleString('tr-TR')} ₺</span></div>
                          </div>
                          <table className="print-table w-full text-left text-sm border-collapse whitespace-nowrap">
                              <thead className="bg-gray-100 border-b">
                                  <tr><th className="p-2 border">Dosya (Köy/Ada/Parsel)</th><th className="p-2 border text-right">DKGH</th><th className="p-2 border text-right">Resmi Maliyet</th><th className="p-2 border text-right">Müşteriye Söylenen</th><th className="p-2 border text-right text-emerald-600">Alınan Peşinat</th><th className="p-2 border text-right text-red-600">Kalan Bakiye</th></tr>
                              </thead>
                              <tbody>
                                  {cJobs.map((row, i) => (
                                      <tr key={i} className="border-b">
                                          <td className="p-2 border font-bold">{row.mahalleKoy} - {row.adaParsel}</td>
                                          <td className="p-2 border text-right font-bold text-blue-700">{row.dkgh}</td>
                                          <td className="p-2 border text-right font-bold text-gray-600">{(row.toplam||0).toLocaleString('tr-TR')} ₺</td>
                                          <td className="p-2 border text-right font-bold text-gray-800">{(row.soylenen||0).toLocaleString('tr-TR')} ₺</td>
                                          <td className="p-2 border text-right font-bold text-emerald-600">{(row.alinanUcret||0).toLocaleString('tr-TR')} ₺</td>
                                          <td className="p-2 border text-right font-black">{(row.kalanUcret||0).toLocaleString('tr-TR')} ₺</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                          </>
                      );
                  })()}
              </div>
           </div>
         </div>
      )}

      {deleteModalId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] animate-fade-in no-print">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center"><Trash2 className="w-5 h-5 mr-2 text-red-600" /> Silme Onayı</h3>
                <p className="text-gray-600 mb-6 font-medium">Bu kaydı silmek istediğinize emin misiniz?</p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setDeleteModalId(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100 font-bold text-gray-700">İptal</button>
                    <button onClick={confirmDeleteAction} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-md">Evet, Sil</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// MODÜL 3: MÜHENDİSLİK (DİKİLİ HESAP / CSV UYUMLU FORMAT)
// ----------------------------------------------------------------------
function MuhendislikTakip({ user, db, appId, showToast }) {
  const [jobs, setJobs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteModalId, setDeleteModalId] = useState(null);

  const initialForm = {
    firma: '', mudurluk: '', seflik: '', bolme: '',
    hacim: '', belgeUcreti: '', odaUcreti: '', ucret: '',
    iskonto: '0', fatura: '', alinan: '', durum: 'BEKLİYOR',
    kdv: '', toplam: '', kalan: ''
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (!user || !db) return;
    const unsubJobs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'muhendislik_projeleri'), (snap) => {
      setJobs(snap.docs.map(d => d.data()).sort((a, b) => (a.siraNo || 0) - (b.siraNo || 0)));
    });
    return () => unsubJobs();
  }, [user, db, appId]);

  const uniqueFirma = useMemo(() => [...new Set(jobs.map(j => j.firma).filter(Boolean))], [jobs]);
  const uniqueMudurluk = useMemo(() => [...new Set(jobs.map(j => j.mudurluk).filter(Boolean))], [jobs]);
  const uniqueSeflik = useMemo(() => [...new Set(jobs.map(j => j.seflik).filter(Boolean))], [jobs]);

  const handleChange = (field, value) => {
    const newForm = { ...formData, [field]: value };
    
    const ucret = parseFloat(newForm.ucret) || 0;
    const oda = parseFloat(newForm.odaUcreti) || 0;
    const belge = parseFloat(newForm.belgeUcreti) || 0;
    const iskonto = parseFloat(newForm.iskonto) || 0;
    const alinan = parseFloat(newForm.alinan) || 0;

    if (['ucret', 'odaUcreti', 'belgeUcreti', 'iskonto'].includes(field)) {
        const kdv = ucret * 0.20;
        const toplam = ucret + kdv + oda + belge;
        let fatura = toplam * (1 - (iskonto / 100));
        
        newForm.kdv = kdv.toFixed(2);
        newForm.toplam = toplam.toFixed(2);
        newForm.fatura = fatura.toFixed(2);
        newForm.kalan = (fatura - alinan).toFixed(2);
    } 
    else if (['fatura', 'alinan'].includes(field)) {
        const fatura = parseFloat(newForm.fatura) || 0;
        newForm.kalan = (fatura - alinan).toFixed(2);
    }

    if (parseFloat(newForm.kalan) <= 0 && parseFloat(newForm.fatura) > 0) newForm.durum = 'ÖDENDİ';
    else if (parseFloat(newForm.kalan) > 0) newForm.durum = 'BEKLİYOR';

    setFormData(newForm);
  };

  const handleOpenAdd = () => { setFormData(initialForm); setEditingId(null); setShowModal(true); };
  const handleOpenEdit = (job) => { setFormData(job); setEditingId(job.id); setShowModal(true); };
  
  const handleDelete = (id) => {
    setDeleteModalId(id);
  };

  const confirmDeleteAction = async () => {
    if (user && db && deleteModalId) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'muhendislik_projeleri', deleteModalId));
        setDeleteModalId(null);
        showToast("Kayıt başarıyla silindi.");
    }
  };

  const handleSave = async () => {
    let siraNo = formData.siraNo;
    if (!editingId) {
        const maxSira = jobs.reduce((max, job) => Math.max(max, job.siraNo || 0), 0);
        siraNo = maxSira + 1;
    }

    const jobData = { 
        ...formData, 
        siraNo, 
        hacim: parseFloat(formData.hacim) || 0,
        belgeUcreti: parseFloat(formData.belgeUcreti) || 0,
        odaUcreti: parseFloat(formData.odaUcreti) || 0,
        ucret: parseFloat(formData.ucret) || 0,
        iskonto: parseFloat(formData.iskonto) || 0,
        kdv: parseFloat(formData.kdv) || 0,
        toplam: parseFloat(formData.toplam) || 0,
        fatura: parseFloat(formData.fatura) || 0,
        alinan: parseFloat(formData.alinan) || 0,
        kalan: parseFloat(formData.kalan) || 0,
        id: editingId || `muh_${Date.now()}` 
    };

    if (user && db) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'muhendislik_projeleri', jobData.id), jobData);
      setShowModal(false); showToast("Kayıt başarıyla kaydedildi!");
    }
  };

  const getStatusColor = (durum) => {
    if (durum === 'ÖDENDİ') return 'bg-emerald-100 text-emerald-800';
    if (durum === 'İPTAL') return 'bg-red-100 text-red-800';
    return 'bg-orange-100 text-orange-800';
  };

  const totalFatura = jobs.reduce((s, j) => s + (j.fatura || 0), 0);
  const totalAlinan = jobs.reduce((s, j) => s + (j.alinan || 0), 0);
  const totalKalan = jobs.reduce((s, j) => s + (j.kalan || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in flex flex-col h-full print-section overflow-y-auto custom-scrollbar pb-8 pr-1">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print shrink-0">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Mühendislik (Dikili Hesap) Dosyaları</h2>
           <p className="text-sm text-gray-500">Excel formülleri (KDV, İskonto) entegre edilmiştir.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => window.print()} className="flex-1 sm:flex-none justify-center bg-gray-800 hover:bg-black text-white px-4 py-2.5 rounded-lg flex items-center shadow-md text-sm font-bold">
            <Printer className="w-4 h-4 mr-2" /> Yazdır
          </button>
          <button onClick={handleOpenAdd} className="flex-1 sm:flex-none justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg flex items-center shadow-md text-sm font-bold">
            <Plus className="w-4 h-4 mr-1" /> Yeni Kayıt
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print shrink-0">
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 font-bold">Toplam Dosya</p><p className="text-xl font-black text-gray-800">{jobs.length} Adet</p></div>
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-500 font-bold">Toplam Fatura (Beklenen)</p><p className="text-xl font-black text-blue-600">{totalFatura.toLocaleString('tr-TR')} ₺</p></div>
         <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm"><p className="text-xs text-emerald-700 font-bold">Toplam Tahsil Edilen</p><p className="text-xl font-black text-emerald-600">{totalAlinan.toLocaleString('tr-TR')} ₺</p></div>
         <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/30 shadow-sm"><p className="text-xs text-red-700 font-bold">Kalan Tahsilat (Alacak)</p><p className="text-xl font-black text-red-600">{totalKalan.toLocaleString('tr-TR')} ₺</p></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 min-h-[400px] relative">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[2000px] print-table">
            <thead className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] uppercase font-bold shadow-sm">
              <tr>
                <th className="p-3 w-12 text-center border-r">No</th>
                <th className="p-3 border-r bg-gray-100/50">Firma</th>
                <th className="p-3">Müdürlük</th>
                <th className="p-3">Şeflik</th>
                <th className="p-3">Bölme</th>
                <th className="p-3 text-right">Hacim</th>
                <th className="p-3 text-right text-gray-400">Belge Ücreti</th>
                <th className="p-3 text-right bg-blue-50/30">Oda Ücreti</th>
                <th className="p-3 text-right text-indigo-700 font-black bg-indigo-50/30">Ücret (Matrah)</th>
                <th className="p-3 text-right text-indigo-700 bg-indigo-50/30">KDV (%20)</th>
                <th className="p-3 text-right font-black text-indigo-900 border-r bg-indigo-100/50">Toplam</th>
                <th className="p-3 text-center text-orange-800 bg-orange-50/30">İskonto (%)</th>
                <th className="p-3 text-right font-black text-gray-800 bg-gray-100">Fatura Tutarı</th>
                <th className="p-3 text-right text-emerald-700 font-bold bg-emerald-50/30">Alınan (Ödenen)</th>
                <th className="p-3 text-right font-black text-red-600 bg-red-50/30 border-r">Kalan (Bakiye)</th>
                <th className="p-3 text-center">Durum</th>
                <th className="p-3 text-center border-l border-gray-200 sticky right-0 z-30 bg-gray-100 no-print shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)]">İşlem</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {jobs.length === 0 ? (
                <tr><td colSpan="17" className="p-8 text-center text-gray-500">Henüz mühendislik kaydı bulunamadı.</td></tr>
              ) : (
                jobs.map((job, idx) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-3 text-center font-bold text-gray-400 border-r">{job.siraNo || idx + 1}</td>
                    <td className="p-3 font-bold text-gray-800 border-r bg-gray-50/30">{job.firma}</td>
                    <td className="p-3 text-gray-600">{job.mudurluk}</td>
                    <td className="p-3 text-gray-600">{job.seflik}</td>
                    <td className="p-3 font-bold">{job.bolme}</td>
                    <td className="p-3 text-right font-medium">{job.hacim}</td>
                    <td className="p-3 text-right text-gray-400">{job.belgeUcreti > 0 ? job.belgeUcreti : '-'}</td>
                    <td className="p-3 text-right bg-blue-50/10">{job.odaUcreti > 0 ? job.odaUcreti.toLocaleString('tr-TR') : '-'}</td>
                    <td className="p-3 text-right font-black text-indigo-700 bg-indigo-50/10">{job.ucret > 0 ? job.ucret.toLocaleString('tr-TR') : '-'}</td>
                    <td className="p-3 text-right text-indigo-700 bg-indigo-50/10">{job.kdv > 0 ? job.kdv.toLocaleString('tr-TR') : '-'}</td>
                    <td className="p-3 text-right font-black text-indigo-900 border-r bg-indigo-50/30">{job.toplam > 0 ? job.toplam.toLocaleString('tr-TR') : '-'}</td>
                    
                    <td className="p-3 text-center text-orange-800 font-bold bg-orange-50/10">{job.iskonto > 0 ? `%${job.iskonto}` : '-'}</td>
                    <td className="p-3 text-right font-black text-gray-800 bg-gray-50">{job.fatura > 0 ? job.fatura.toLocaleString('tr-TR') : '-'}</td>
                    <td className="p-3 text-right font-bold text-emerald-600 bg-emerald-50/10">{job.alinan > 0 ? job.alinan.toLocaleString('tr-TR') : '-'}</td>
                    <td className="p-3 text-right font-black text-red-600 bg-red-50/10 border-r">{job.kalan > 0 ? job.kalan.toLocaleString('tr-TR') : (job.kalan <= 0 && job.fatura > 0 ? '0' : '-')}</td>
                    
                    <td className="p-3 text-center"><span className={`px-2 py-1 text-[10px] font-bold rounded border ${getStatusColor(job.durumu)}`}>{job.durumu}</span></td>
                    <td className="p-3 text-center border-l border-gray-200 sticky right-0 z-10 bg-white group-hover:bg-gray-50 no-print shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.05)] transition-colors">
                       <div className="flex items-center justify-center gap-2">
                         <button onClick={() => handleOpenEdit(job)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"><Pencil className="w-4 h-4"/></button>
                         <button onClick={() => handleDelete(job.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-start justify-center p-4 pt-10 overflow-y-auto no-print animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col my-8">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <FileText className="w-6 h-6 mr-2 text-indigo-600" /> {editingId ? 'Mühendislik Kaydını Düzenle' : 'Yeni Mühendislik Kaydı Ekle'}
              </h3>
              <button onClick={() => setShowModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-gray-700" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Firma Adı</label>
                      <input type="text" list="list-muh-firma" className="w-full p-2 border rounded font-bold uppercase" value={formData.firma} onChange={e => handleChange('firma', e.target.value)} autoFocus placeholder="Seç/Yaz" />
                      <datalist id="list-muh-firma">{uniqueFirma.map(i => <option key={i} value={i}/>)}</datalist>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Müdürlük</label>
                      <input type="text" list="list-muh-mudurluk" className="w-full p-2 border rounded uppercase" value={formData.mudurluk} onChange={e => handleChange('mudurluk', e.target.value)} placeholder="Seç/Yaz" />
                      <datalist id="list-muh-mudurluk">{uniqueMudurluk.map(i => <option key={i} value={i}/>)}</datalist>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Şeflik</label>
                      <input type="text" list="list-muh-seflik" className="w-full p-2 border rounded uppercase" value={formData.seflik} onChange={e => handleChange('seflik', e.target.value)} placeholder="Seç/Yaz" />
                      <datalist id="list-muh-seflik">{uniqueSeflik.map(i => <option key={i} value={i}/>)}</datalist>
                  </div>
                  
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Bölme No</label><input type="text" className="w-full p-2 border rounded font-bold" value={formData.bolme} onChange={e => handleChange('bolme', e.target.value)} /></div>
                  <div><label className="block text-xs font-bold text-gray-700 mb-1">Hacim (m³)</label><input type="number" step="0.01" className="w-full p-2 border rounded" value={formData.hacim} onChange={e => handleChange('hacim', e.target.value)} /></div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Durumu</label>
                    <select className="w-full p-2 border rounded font-bold bg-gray-50" value={formData.durum} onChange={e => handleChange('durum', e.target.value)}>
                       <option value="BEKLİYOR">BEKLİYOR</option><option value="ÖDENDİ">ÖDENDİ</option><option value="İPTAL">İPTAL</option>
                    </select>
                  </div>
              </div>

              <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
                <h4 className="text-sm font-black text-indigo-800 mb-3 border-b border-indigo-200 pb-2">HESAPLAMALAR VE KDV (Otomatik)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">Belge Ücreti</label><input type="number" className="w-full p-2 border rounded" value={formData.belgeUcreti} onChange={e => handleChange('belgeUcreti', e.target.value)}/></div>
                    <div><label className="block text-xs font-bold text-blue-700 mb-1">Oda Ücreti</label><input type="number" className="w-full p-2 border border-blue-200 bg-blue-50 font-bold rounded" value={formData.odaUcreti} onChange={e => handleChange('odaUcreti', e.target.value)}/></div>
                    <div><label className="block text-xs font-black text-indigo-700 mb-1">Ücret (Ana Matrah)</label><input type="number" className="w-full p-2 border border-indigo-300 bg-white font-black rounded focus:ring-2 focus:ring-indigo-500 shadow-inner" value={formData.ucret} onChange={e => handleChange('ucret', e.target.value)}/></div>
                    
                    <div className="bg-white p-2 rounded border border-indigo-200 shadow-sm flex flex-col justify-center items-center">
                        <span className="text-[10px] text-gray-500 font-bold mb-1">Hesaplanan KDV (%20)</span>
                        <span className="text-lg font-black text-indigo-600">{formData.kdv || '0.00'} ₺</span>
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                     <h4 className="text-sm font-black text-gray-700 border-b border-gray-200 pb-2">FATURA / İSKONTO</h4>
                     <div className="flex justify-between items-center gap-2">
                       <label className="text-xs font-bold text-gray-700 w-1/2">Genel Toplam (Ücret+KDV+Oda)</label>
                       <div className="w-1/2 text-right font-black text-gray-800">{formData.toplam || '0.00'} ₺</div>
                     </div>
                     <div className="flex justify-between items-center gap-2">
                       <label className="text-xs font-bold text-orange-700 w-1/2">İskonto Oranı (%)</label>
                       <input type="number" className="w-1/2 p-2 border border-orange-300 rounded text-right text-sm outline-none font-bold bg-orange-50 focus:ring-2 focus:ring-orange-500" value={formData.iskonto} onChange={e => handleChange('iskonto', e.target.value)} />
                     </div>
                     <div className="pt-2 flex justify-between items-center border-t border-gray-200">
                       <label className="text-sm font-black text-indigo-900">KESİLECEK FATURA</label>
                       <input type="number" className="w-1/2 p-2 border-2 border-indigo-500 rounded text-right text-lg outline-none font-black bg-white" value={formData.fatura} onChange={e => handleChange('fatura', e.target.value)} title="Elle değiştirebilirsiniz" />
                     </div>
                 </div>

                 <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 space-y-3 flex flex-col justify-end">
                     <h4 className="text-sm font-black text-emerald-800 border-b border-emerald-200 pb-2">TAHSİLAT VE BAKİYE</h4>
                     <div className="flex justify-between items-center gap-2 mt-auto">
                       <label className="text-xs font-bold text-gray-700 w-1/2">Alınan Ücret / Ödeme</label>
                       <input type="number" className="w-1/2 p-2 border border-emerald-400 rounded text-right text-sm outline-none font-bold text-emerald-700 bg-white focus:ring-2 focus:ring-emerald-500" value={formData.alinan} onChange={e => handleChange('alinan', e.target.value)} />
                     </div>
                     <div className="pt-2 flex justify-between items-center border-t border-emerald-200">
                       <span className="text-sm font-black text-red-800">KALAN BORÇ (ALACAK)</span>
                       <span className="text-2xl font-black text-red-600">{formData.kalan || '0.00'} ₺</span>
                     </div>
                 </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-100">İptal</button>
              <button onClick={handleSave} className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {deleteModalId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[200] animate-fade-in no-print">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center"><Trash2 className="w-5 h-5 mr-2 text-red-600" /> Silme Onayı</h3>
                <p className="text-gray-600 mb-6 font-medium">Bu kaydı silmek istediğinize emin misiniz?</p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setDeleteModalId(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100 font-bold text-gray-700">İptal</button>
                    <button onClick={confirmDeleteAction} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-md">Evet, Sil</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}