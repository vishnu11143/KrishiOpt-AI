import { useState, useEffect, useRef } from 'react'
import { api } from '../api'

// Geographic coordinates for Indian agricultural states in the dataset
const STATE_COORDS = {
  'Andhra Pradesh': { lat: 15.9129, lng: 79.74 },
  'Gujarat': { lat: 22.2587, lng: 71.1924 },
  'Karnataka': { lat: 15.3173, lng: 75.7139 },
  'Madhya Pradesh': { lat: 22.9734, lng: 78.6569 },
  'Maharashtra': { lat: 19.7515, lng: 75.7139 },
  'Punjab': { lat: 31.1471, lng: 75.3412 },
  'Tamil Nadu': { lat: 11.1271, lng: 78.6569 },
  'Telangana': { lat: 18.1124, lng: 79.0193 },
}

const INDIA_CENTER = { lat: 21.7679, lng: 78.8718 }

// Subtle agricultural dark map theme
const DARK_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1a232a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a232a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8fa394' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#b9ccbf' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#74927f' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1d3326' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#273842' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a232a' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2f4958' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0f171d' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#456150' }],
  },
]

// Universal robust Google Maps loader (works with or without key, zero deprecation issues)
function loadGoogleMapsScript(key) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      return resolve(window.google)
    }

    const callbackName = `__initGoogleMaps_${Date.now()}`
    window[callbackName] = () => {
      delete window[callbackName]
      resolve(window.google)
    }

    window.gm_authFailure = () => {
      console.warn('Google Maps authentication failure: Check GOOGLE_MAPS_API_KEY.')
    }

    const script = document.createElement('script')
    script.id = 'google-maps-api-script'
    script.async = true
    script.defer = true
    const keyParam = key && key.trim() ? `key=${key.trim()}&` : ''
    script.src = `https://maps.googleapis.com/maps/api/js?${keyParam}libraries=places,geometry&callback=${callbackName}&loading=async`

    script.onerror = () => {
      delete window[callbackName]
      reject(new Error('Failed to load Google Maps script'))
    }

    document.head.appendChild(script)
  })
}

export default function AgriMap() {
  const [states, setStates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedState, setSelectedState] = useState(null)
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '')
  const [manualKeyInput, setManualKeyInput] = useState('')
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [mapError, setMapError] = useState(null)
  const [searchPlaceName, setSearchPlaceName] = useState('')

  const mapDivRef = useRef(null)
  const searchInputRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef({})
  const searchMarkerRef = useRef(null)
  const infoWindowRef = useRef(null)

  // 1. Fetch state analytics and config
  useEffect(() => {
    Promise.all([
      api.stateAnalytics().catch(() => null),
      api.config().catch(() => null),
    ])
      .then(([stateData, configData]) => {
        if (stateData) setStates(stateData)
        if (!apiKey && configData?.google_maps_api_key) {
          setApiKey(configData.google_maps_api_key)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // 2. Initialize Real Google Map
  useEffect(() => {
    if (!mapDivRef.current || !states) return

    let isSubscribed = true

    loadGoogleMapsScript(apiKey)
      .then((google) => {
        if (!isSubscribed || !mapDivRef.current) return

        // Create Real Google Map Instance
        const map = new google.maps.Map(mapDivRef.current, {
          center: INDIA_CENTER,
          zoom: 5,
          styles: DARK_MAP_STYLES,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: google.maps.ControlPosition.TOP_RIGHT,
          },
          fullscreenControl: true,
          streetViewControl: false,
          zoomControl: true,
        })
        mapInstanceRef.current = map

        // Shared InfoWindow
        const infoWindow = new google.maps.InfoWindow()
        infoWindowRef.current = infoWindow

        // Clear existing markers
        Object.values(markersRef.current).forEach((m) => m.setMap(null))
        markersRef.current = {}

        // Add markers for all 8 agricultural states
        states.forEach((s) => {
          const coords = STATE_COORDS[s.state]
          if (!coords) return

          const riskColor =
            s.Disease_Pest_Risk_pct > 55 ? '#ef4444' : s.Disease_Pest_Risk_pct > 35 ? '#f59e0b' : '#10b981'

          // Custom SVG Pin Icon
          const svgIcon = {
            url: `data:image/svg+xml;utf-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
                <defs>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="0.5"/>
                  </filter>
                </defs>
                <path d="M19 0 C8.5 0 0 8.5 0 19 C0 32 19 48 19 48 C19 48 38 32 38 19 C38 8.5 29.5 0 19 0 Z" fill="${riskColor}" filter="url(#shadow)"/>
                <circle cx="19" cy="18" r="13" fill="#121a21"/>
                <text x="19" y="23" font-size="14" text-anchor="middle" fill="#ffffff">🌾</text>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(38, 48),
            anchor: new google.maps.Point(19, 48),
          }

          const marker = new google.maps.Marker({
            position: coords,
            map: map,
            title: s.state,
            icon: svgIcon,
            animation: google.maps.Animation.DROP,
          })

          const infoContent = `
            <div style="font-family: inherit; font-size: 13px; line-height: 1.4; min-width: 210px; color: #e5ece6;">
              <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px; color: #22c55e;">
                📍 ${s.state}
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; font-size: 11px;">
                <div style="background: rgba(255,255,255,0.06); padding: 5px 8px; border-radius: 4px;">
                  <span style="opacity: 0.7;">Records</span><br/><strong>${s.count}</strong>
                </div>
                <div style="background: rgba(255,255,255,0.06); padding: 5px 8px; border-radius: 4px;">
                  <span style="opacity: 0.7;">Avg Yield</span><br/><strong>${s.Yield_Tonnes_Ha} t/ha</strong>
                </div>
                <div style="background: rgba(255,255,255,0.06); padding: 5px 8px; border-radius: 4px;">
                  <span style="opacity: 0.7;">Avg Profit</span><br/><strong>₹${Number(s.Profit_INR).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div style="background: rgba(255,255,255,0.06); padding: 5px 8px; border-radius: 4px;">
                  <span style="opacity: 0.7;">Risk</span><br/><strong style="color: ${riskColor}">${s.Disease_Pest_Risk_pct}%</strong>
                </div>
              </div>
              <div style="font-size: 11px; opacity: 0.85; margin-bottom: 8px;">
                <strong>Crops:</strong> ${s.crops.slice(0, 4).join(', ')}${s.crops.length > 4 ? '...' : ''}
              </div>
              <button id="btn-select-${s.state.replace(/\s+/g, '-')}" style="background: #22c55e; color: #0b130e; border: none; border-radius: 4px; padding: 5px 10px; font-weight: 600; font-size: 11px; cursor: pointer; width: 100%;">
                Select ${s.state} Profile
              </button>
            </div>
          `

          marker.addListener('click', () => {
            setSelectedState(s.state)
            infoWindow.setContent(infoContent)
            infoWindow.open(map, marker)

            google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
              const btn = document.getElementById(`btn-select-${s.state.replace(/\s+/g, '-')}`)
              if (btn) {
                btn.onclick = () => setSelectedState(s.state)
              }
            })
          })

          markersRef.current[s.state] = marker
        })

        // Setup Google Places Autocomplete
        if (searchInputRef.current && google.maps.places) {
          const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
            componentRestrictions: { country: 'in' },
            fields: ['geometry', 'name', 'formatted_address'],
          })
          autocomplete.bindTo('bounds', map)

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace()
            if (!place.geometry || !place.geometry.location) return

            setSearchPlaceName(place.name || place.formatted_address || 'Selected Location')
            map.panTo(place.geometry.location)
            map.setZoom(10)

            if (!searchMarkerRef.current) {
              searchMarkerRef.current = new google.maps.Marker({
                map,
                icon: {
                  url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                },
              })
            }
            searchMarkerRef.current.setPosition(place.geometry.location)
            searchMarkerRef.current.setTitle(place.name || 'Searched Location')
          })
        }

        setIsMapLoaded(true)
        setMapError(null)
      })
      .catch((err) => {
        console.warn('Google Maps loader error:', err)
        setMapError(err?.message || 'Failed to load Google Maps.')
      })

    return () => {
      isSubscribed = false
    }
  }, [apiKey, states])

  // 3. Pan and zoom map when selectedState changes
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedState) return

    const coords = STATE_COORDS[selectedState]
    const marker = markersRef.current[selectedState]
    if (coords) {
      mapInstanceRef.current.panTo(coords)
      mapInstanceRef.current.setZoom(7)
      if (marker && infoWindowRef.current && window.google) {
        new window.google.maps.event.trigger(marker, 'click')
      }
    }
  }, [selectedState])

  const handleResetMap = () => {
    setSelectedState(null)
    if (infoWindowRef.current) infoWindowRef.current.close()
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(INDIA_CENTER)
      mapInstanceRef.current.setZoom(5)
    }
  }

  const handleApplyManualKey = (e) => {
    e.preventDefault()
    if (manualKeyInput.trim()) {
      setApiKey(manualKeyInput.trim())
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading agricultural map & dataset analytics...</p>
      </div>
    )
  }

  const stateInfo = selectedState ? states?.find((s) => s.state === selectedState) : null

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <div>
          <h1>🗺️ Agricultural Regional Intelligence Map</h1>
          <p className="page-subtitle">
            Interactive Google Map visualization across {states?.length || 8} major Indian agricultural states
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isMapLoaded ? (
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span>📍</span> Google Maps Active
            </span>
          ) : (
            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span>⏳</span> Initializing Google Map...
            </span>
          )}
        </div>
      </div>

      {/* API Key Setup Banner if no key configured in environment */}
      {!apiKey && (
        <div className="card mb-md" style={{ borderLeft: '4px solid var(--accent)', background: 'rgba(34, 197, 94, 0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>
                🔑 Configure Your Production GOOGLE_MAPS_API_KEY
              </div>
              <p className="text-xs text-muted" style={{ margin: 0, maxWidth: 650 }}>
                Set <code>GOOGLE_MAPS_API_KEY=your_key</code> in your root <code>.env</code> file (or <code>VITE_GOOGLE_MAPS_API_KEY</code> in <code>frontend/.env</code>) to remove developer watermarks and enable production Places/Geocoding quotas.
              </p>
            </div>
            <form onSubmit={handleApplyManualKey} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Paste API Key here..."
                value={manualKeyInput}
                onChange={(e) => setManualKeyInput(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '0.8rem', width: 220 }}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={!manualKeyInput.trim()}>
                Apply
              </button>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
        {/* State selector panel */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div className="card" style={{ position: 'sticky', top: 'var(--space-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <div className="card-title" style={{ margin: 0 }}>Select State</div>
              {selectedState && (
                <button className="btn btn-secondary btn-sm" onClick={handleResetMap} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                  Reset View
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {states?.map((s) => {
                const isSelected = selectedState === s.state
                const riskColor = s.Disease_Pest_Risk_pct > 55 ? 'var(--danger)' : s.Disease_Pest_Risk_pct > 35 ? 'var(--warning)' : 'var(--success)'
                return (
                  <div
                    key={s.state}
                    className={`nav-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedState(isSelected ? null : s.state)}
                    role="button"
                    tabIndex={0}
                    style={{ padding: '8px 12px' }}
                  >
                    <span className="nav-icon" style={{ color: riskColor, fontSize: '1rem' }}>📍</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.83rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{s.state}</span>
                        <span style={{ fontSize: '0.72rem', color: riskColor }}>{s.Disease_Pest_Risk_pct}% risk</span>
                      </div>
                      <div className="text-xs text-muted" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        <span>{s.count} records</span>
                        <span>Avg: {s.Yield_Tonnes_Ha} t/ha</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Map View + Info */}
        <div style={{ flex: 1, minWidth: 400 }}>
          <div className="map-container" style={{ height: 540, position: 'relative' }}>
            {/* Search Bar / Controls on top of map */}
            <div className="map-controls">
              <input
                ref={searchInputRef}
                type="text"
                className="gmap-search-box"
                placeholder="🔍 Search Indian city or farm district..."
              />
              <button className="btn btn-secondary btn-sm" onClick={handleResetMap} title="Center on India">
                🇮🇳 All India
              </button>
            </div>

            {/* Google Map Div Container */}
            <div
              ref={mapDivRef}
              style={{
                width: '100%',
                height: '100%',
                minHeight: 540,
                borderRadius: 'var(--radius-lg)',
              }}
            />
          </div>

          {searchPlaceName && (
            <div className="text-xs text-muted mt-sm" style={{ padding: '0 4px' }}>
              📍 Searched pin: <strong>{searchPlaceName}</strong>
            </div>
          )}

          {/* Selected State Agricultural Profile */}
          {stateInfo && (
            <div className="card mt-md fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <div className="card-title" style={{ margin: 0 }}>📊 {stateInfo.state} — Agricultural Profile</div>
                <span className="badge badge-neutral">{stateInfo.count} Field Records</span>
              </div>
              <div className="stat-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card">
                  <div className="stat-label">Dataset Records</div>
                  <div className="stat-value">{stateInfo.count}</div>
                  <div className="stat-subtext">Verified farm observations</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Avg Crop Yield</div>
                  <div className="stat-value">
                    {stateInfo.Yield_Tonnes_Ha} <span className="text-xs text-muted">t/ha</span>
                  </div>
                  <div className="stat-subtext">Regional average</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Avg Profit per Farm</div>
                  <div
                    className="stat-value"
                    style={{
                      color: stateInfo.Profit_INR >= 0 ? 'var(--success)' : 'var(--danger)',
                      fontSize: '1.05rem',
                    }}
                  >
                    ₹{Number(stateInfo.Profit_INR).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="stat-subtext">Net farm margin</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Disease/Pest Risk</div>
                  <div
                    className={`stat-value risk-${
                      stateInfo.Disease_Pest_Risk_pct > 55
                        ? 'high'
                        : stateInfo.Disease_Pest_Risk_pct > 35
                        ? 'moderate'
                        : 'low'
                    }`}
                  >
                    {stateInfo.Disease_Pest_Risk_pct}%
                  </div>
                  <div className="stat-subtext">Environmental vulnerability</div>
                </div>
              </div>

              <div className="mt-md" style={{ paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--border-secondary)' }}>
                <div className="text-xs text-muted" style={{ marginBottom: 6 }}>
                  Primary Crops Cultivated in {stateInfo.state}:
                </div>
                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  {stateInfo.crops.map((c) => (
                    <span key={c} className="badge badge-neutral" style={{ padding: '4px 10px' }}>
                      🌾 {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
