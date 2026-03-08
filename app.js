class WeatherApp {
    constructor() {
        // API Configuration
        this.geoApiUrl = 'https://geocoding-api.open-meteo.com/v1/search';
        this.weatherApiUrl = 'https://api.open-meteo.com/v1/forecast';

        // Default location (New York)
        this.defaultCity = 'New York';
        this.defaultLat = 40.7128;
        this.defaultLon = -74.0060;

        // Current state
        this.currentLocation = null;
        this.weatherData = null;
        this.isOnline = navigator.onLine;

        // DOM Elements
        this.elements = {
            // Status
            connectionStatus: document.getElementById('connectionStatus'),
            statusText: document.getElementById('statusText'),
            lastUpdated: document.getElementById('lastUpdated'),
            offlineNotice: document.getElementById('offlineNotice'),

            // Search
            searchInput: document.getElementById('searchInput'),
            searchBtn: document.getElementById('searchBtn'),
            searchResults: document.getElementById('searchResults'),

            // Buttons
            refreshBtn: document.getElementById('refreshBtn'),
            locationBtn: document.getElementById('locationBtn'),
            retryBtn: document.getElementById('retryBtn'),

            // States
            loadingState: document.getElementById('loadingState'),
            errorState: document.getElementById('errorState'),
            weatherContent: document.getElementById('weatherContent'),

            // Error
            errorTitle: document.getElementById('errorTitle'),
            errorMessage: document.getElementById('errorMessage'),

            // Current Weather
            cityName: document.getElementById('cityName'),
            countryName: document.getElementById('countryName'),
            mainIcon: document.getElementById('mainIcon'),
            currentTemp: document.getElementById('currentTemp'),
            weatherDescription: document.getElementById('weatherDescription'),

            // Details
            feelsLike: document.getElementById('feelsLike'),
            humidity: document.getElementById('humidity'),
            windSpeed: document.getElementById('windSpeed'),
            uvIndex: document.getElementById('uvIndex'),
            visibility: document.getElementById('visibility'),
            pressure: document.getElementById('pressure'),

            // Forecasts
            hourlyForecast: document.getElementById('hourlyForecast'),
            dailyForecast: document.getElementById('dailyForecast')
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateConnectionStatus();
        this.registerServiceWorker();
        this.initLocation();
        this.loadCachedData();
    }

    setupEventListeners() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        this.elements.searchBtn.addEventListener('click', () => this.handleSearch());
        this.elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        this.elements.searchInput.addEventListener('input', (e) => this.handleSearchInput(e));

        this.elements.refreshBtn.addEventListener('click', () => this.refreshWeather());
        this.elements.locationBtn.addEventListener('click', () => this.initLocation());
        this.elements.retryBtn.addEventListener('click', () => this.refreshWeather());

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-section')) {
                this.elements.searchResults.classList.remove('active');
            }
        });
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registered:', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
        }
    }

    updateConnectionStatus() {
        this.isOnline = navigator.onLine;

        if (this.isOnline) {
            this.elements.connectionStatus.className = 'status-dot online';
            this.elements.statusText.textContent = 'Online';
            this.elements.offlineNotice.classList.add('hidden');
            document.body.classList.remove('night-mode');
        } else {
            this.elements.connectionStatus.className = 'status-dot offline';
            this.elements.statusText.textContent = 'Offline';
            this.elements.offlineNotice.classList.remove('hidden');
        }
    }

    handleOnline() {
        this.updateConnectionStatus();
        this.refreshWeather();
    }

    handleOffline() {
        this.updateConnectionStatus();
        this.loadCachedData();
    }

    initLocation() {
        if (!navigator.geolocation) {
            console.log('Geolocation not supported');
            this.loadDefaultLocation();
            return;
        }

        this.elements.locationBtn.classList.add('loading');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.elements.locationBtn.classList.remove('loading');
                this.getCityFromCoords(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                this.elements.locationBtn.classList.remove('loading');
                console.log('Geolocation error:', error.message);
                this.loadCachedData();
            }, { timeout: 10000, enableHighAccuracy: true }
        );
    }

    async getCityFromCoords(lat, lon) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
            );
            const data = await response.json();

            const city = data.address.city || data.address.town || data.address.village || data.address.county;
            const country = data.address.country_code ? data.address.country_code.toUpperCase() : '';

            if (city) {
                this.currentLocation = { city, country, lat, lon };
                this.fetchWeatherData(lat, lon);
            } else {
                this.fetchWeatherData(lat, lon);
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            this.fetchWeatherData(lat, lon);
        }
    }

    loadDefaultLocation() {
        this.fetchWeatherData(this.defaultLat, this.defaultLon, this.defaultCity);
    }

    async handleSearch() {
        const query = this.elements.searchInput.value.trim();
        if (!query) return;

        this.elements.searchBtn.disabled = true;

        try {
            const response = await fetch(`${this.geoApiUrl}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                this.displaySearchResults(data.results);
            } else {
                this.elements.searchResults.innerHTML = '<div class="search-result-item">No cities found</div>';
                this.elements.searchResults.classList.add('active');
            }
        } catch (error) {
            console.error('Search error:', error);
        }

        this.elements.searchBtn.disabled = false;
    }

    handleSearchInput(e) {
        const query = e.target.value.trim();
        if (query.length < 2) {
            this.elements.searchResults.classList.remove('active');
            return;
        }

        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.handleSearch(), 300);
    }

    displaySearchResults(results) {
        this.elements.searchResults.innerHTML = results.map(city => `
            <div class="search-result-item" data-lat="${city.latitude}" data-lon="${city.longitude}" data-city="${city.name}" data-country="${city.country_code || ''}">
                <span class="search-result-icon">📍</span>
                <div class="search-result-info">
                    <div class="search-result-name">${city.name}</div>
                    <div class="search-result-country">${city.admin1 ? city.admin1 + ', ' : ''}${city.country || ''}</div>
                </div>
            </div>
        `).join('');

        this.elements.searchResults.classList.add('active');

        this.elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = item.dataset.lat;
                const lon = item.dataset.lon;
                const city = item.dataset.city;
                const country = item.dataset.country;
                this.currentLocation = { city, country, lat: parseFloat(lat), lon: parseFloat(lon) };
                this.fetchWeatherData(parseFloat(lat), parseFloat(lon));
                this.elements.searchResults.classList.remove('active');
                this.elements.searchInput.value = '';
            });
        });
    }

    async fetchWeatherData(lat, lon, cityName = null) {
        this.showLoading();

        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,uv_index',
            hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,cloud_cover,wind_speed_10m,uv_index',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max',
            timezone: 'auto',
            forecast_days: 7
        });

        try {
            const response = await fetch(`${this.weatherApiUrl}?${params}`);

            if (!response.ok) {
                throw new Error('Weather API error');
            }

            const data = await response.json();

            if (!this.currentLocation) {
                this.currentLocation = {
                    city: cityName || this.defaultCity,
                    country: '',
                    lat,
                    lon
                };
            }

            this.weatherData = this.processWeatherData(data);
            this.displayWeather(this.weatherData);
            this.cacheWeatherData();

        } catch (error) {
            console.error('Weather fetch error:', error);
            this.showError('Unable to fetch weather data', 'Please check your internet connection and try again');
            this.loadCachedData();
        }
    }

    processWeatherData(data) {
        const current = data.current;
        const hourly = data.hourly;
        const daily = data.daily;

        const now = new Date();
        const currentHourIndex = now.getHours();

        const hourlyData = [];
        for (let i = 0; i < 24; i++) {
            const hourIndex = (currentHourIndex + i);
            hourlyData.push({
                time: hourly.time[hourIndex],
                temp: Math.round(hourly.temperature_2m[hourIndex]),
                icon: this.getWeatherIcon(hourly.weather_code[hourIndex]),
                precip: hourly.precipitation_probability[hourIndex] || 0
            });
        }

        const dailyData = [];
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        for (let i = 0; i < daily.time.length; i++) {
            const date = new Date(daily.time[i]);
            dailyData.push({
                day: i === 0 ? 'Today' : days[date.getDay()],
                date: daily.time[i],
                icon: this.getWeatherIcon(daily.weather_code[i]),
                condition: this.getWeatherDescription(daily.weather_code[i]),
                high: Math.round(daily.temperature_2m_max[i]),
                low: Math.round(daily.temperature_2m_min[i]),
                precip: daily.precipitation_probability_max[i] || 0
            });
        }

        return {
            current: {
                temp: Math.round(current.temperature_2m),
                feelsLike: Math.round(current.apparent_temperature),
                humidity: current.relative_humidity_2m,
                windSpeed: Math.round(current.wind_speed_10m),
                uvIndex: current.uv_index || 0,
                pressure: Math.round(current.pressure_msl),
                visibility: 10,
                description: this.getWeatherDescription(current.weather_code),
                icon: this.getWeatherIcon(current.weather_code),
                isDay: current.is_day === 1
            },
            hourly: hourlyData,
            daily: dailyData
        };
    }

    getWeatherIcon(code) {
        const icons = {
            0: '☀️',
            1: '🌤️',
            2: '⛅',
            3: '☁️',
            45: '🌫️',
            48: '🌫️',
            51: '🌧️',
            53: '🌧️',
            55: '🌧️',
            56: '🌧️',
            57: '🌧️',
            61: '🌧️',
            63: '🌧️',
            65: '🌧️',
            66: '🌧️',
            67: '🌧️',
            71: '🌨️',
            73: '🌨️',
            75: '❄️',
            77: '🌨️',
            80: '🌦️',
            81: '🌦️',
            82: '🌦️',
            85: '🌨️',
            86: '🌨️',
            95: '⛈️',
            96: '⛈️',
            99: '⛈️'
        };

        return icons[code] || '🌤️';
    }

    getWeatherDescription(code) {
        const descriptions = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Fog',
            48: 'Depositing rime fog',
            51: 'Light drizzle',
            53: 'Moderate drizzle',
            55: 'Dense drizzle',
            56: 'Light freezing drizzle',
            57: 'Dense freezing drizzle',
            61: 'Light rain',
            63: 'Moderate rain',
            65: 'Heavy rain',
            66: 'Light freezing rain',
            67: 'Heavy freezing rain',
            71: 'Light snow',
            73: 'Moderate snow',
            75: 'Heavy snow',
            77: 'Snow grains',
            80: 'Slight rain showers',
            81: 'Moderate rain showers',
            82: 'Violent rain showers',
            85: 'Slight snow showers',
            86: 'Heavy snow showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm with hail',
            99: 'Thunderstorm with heavy hail'
        };

        return descriptions[code] || 'Unknown';
    }

    showLoading() {
        this.elements.loadingState.classList.remove('hidden');
        this.elements.errorState.classList.add('hidden');
        this.elements.weatherContent.classList.add('hidden');
    }

    showError(title, message) {
        this.elements.loadingState.classList.add('hidden');
        this.elements.errorState.classList.remove('hidden');
        this.elements.weatherContent.classList.add('hidden');

        this.elements.errorTitle.textContent = title;
        this.elements.errorMessage.textContent = message;
    }

    displayWeather(data) {
        this.elements.loadingState.classList.add('hidden');
        this.elements.errorState.classList.add('hidden');
        this.elements.weatherContent.classList.remove('hidden');

        this.elements.cityName.textContent = this.currentLocation ? this.currentLocation.city : 'Unknown';
        this.elements.countryName.textContent = this.currentLocation ? this.currentLocation.country : '';
        this.elements.mainIcon.textContent = data.current.icon;
        this.elements.currentTemp.textContent = data.current.temp;
        this.elements.weatherDescription.textContent = data.current.description;

        this.elements.feelsLike.textContent = data.current.feelsLike + '°';
        this.elements.humidity.textContent = data.current.humidity + '%';
        this.elements.windSpeed.textContent = data.current.windSpeed + ' km/h';
        this.elements.uvIndex.textContent = data.current.uvIndex.toFixed(1);
        this.elements.visibility.textContent = data.current.visibility + ' km';
        this.elements.pressure.textContent = data.current.pressure + ' hPa';

        if (!data.current.isDay) {
            document.body.classList.add('night-mode');
        } else {
            document.body.classList.remove('night-mode');
        }

        this.displayHourlyForecast(data.hourly);
        this.displayDailyForecast(data.daily);
        this.updateLastUpdated();
    }

    displayHourlyForecast(hourlyData) {
        this.elements.hourlyForecast.innerHTML = hourlyData.map((hour, index) => {
            const date = new Date(hour.time);
            const hourStr = date.getHours();
            const timeLabel = index === 0 ? 'Now' : hourStr + ':00';
            const isActive = index === 0 ? 'active' : '';

            return '<div class="hourly-item ' + isActive + '">' +
                '<div class="hourly-time">' + timeLabel + '</div>' +
                '<div class="hourly-icon">' + hour.icon + '</div>' +
                '<div class="hourly-temp">' + hour.temp + '°</div>' +
                '</div>';
        }).join('');
    }

    displayDailyForecast(dailyData) {
        this.elements.dailyForecast.innerHTML = dailyData.map((day, index) => {
            const isToday = index === 0 ? 'today' : '';
            let precipHtml = day.precip > 0 ? '<div class="daily-precip"><span>💧</span>' + day.precip + '%</div>' : '';

            return '<div class="daily-item ' + isToday + '">' +
                '<div class="daily-day">' + day.day + '</div>' +
                '<div class="daily-icon">' + day.icon + '</div>' +
                '<div class="daily-condition">' + day.condition + '</div>' +
                '<div class="daily-temps">' +
                '<span class="daily-high">' + day.high + '°</span>' +
                '<span class="daily-low">' + day.low + '°</span>' +
                '</div>' +
                precipHtml +
                '</div>';
        }).join('');
    }

    updateLastUpdated() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.elements.lastUpdated.textContent = 'Last updated: ' + timeStr;
    }

    cacheWeatherData() {
        if (!this.weatherData || !this.currentLocation) return;

        const cacheData = {
            location: this.currentLocation,
            weather: this.weatherData,
            timestamp: Date.now()
        };

        localStorage.setItem('weatherCache', JSON.stringify(cacheData));
    }

    loadCachedData() {
        const cached = localStorage.getItem('weatherCache');

        if (cached) {
            try {
                const data = JSON.parse(cached);
                const cacheAge = Date.now() - data.timestamp;
                const maxAge = 6 * 60 * 60 * 1000;

                if (cacheAge < maxAge) {
                    this.currentLocation = data.location;
                    this.weatherData = data.weather;
                    this.displayWeather(this.weatherData);

                    if (!navigator.onLine) {
                        this.elements.offlineNotice.classList.remove('hidden');
                    }

                    return true;
                }
            } catch (e) {
                console.error('Cache error:', e);
            }
        }

        if (!navigator.onLine) {
            this.showError('No cached data', 'Please connect to the internet to get weather data');
        } else {
            this.loadDefaultLocation();
        }

        return false;
    }

    refreshWeather() {
        this.elements.refreshBtn.classList.add('loading');

        if (this.currentLocation) {
            this.fetchWeatherData(this.currentLocation.lat, this.currentLocation.lon);
        } else if (navigator.geolocation) {
            this.initLocation();
        } else {
            this.loadDefaultLocation();
        }

        setTimeout(() => {
            this.elements.refreshBtn.classList.remove('loading');
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.weatherApp = new WeatherApp();
});