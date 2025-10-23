const weatherContainer = document.getElementById("weatherContainer");
const loadingElement = document.getElementById("loading");
const errorContainer = document.getElementById("errorContainer");
const currentLocationBtn = document.getElementById("currentLocationBtn");
const themeToggle = document.getElementById("themeToggle");
const retryBtn = document.getElementById("retryBtn");
const lastUpdateElement = document.getElementById("lastUpdate");

let windMap = null;
let currentLocation = null;
let updateInterval = null;
let isPageVisible = true;

const WeatherManager = {
    init() {
        this.setupEventListeners();
        this.initializeWindMap();
        this.setupVisibilityHandler();
        this.loadUserLocation();
    },

    setupEventListeners() {
        currentLocationBtn.addEventListener("click", () => this.loadUserLocation());
        themeToggle.addEventListener("click", this.toggleTheme);
        retryBtn.addEventListener("click", () => this.loadUserLocation());
    },

    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            isPageVisible = !document.hidden;
            if (isPageVisible && !updateInterval) {
                this.startAutoUpdate();
            }
        });
    },

    initializeWindMap() {
        windMap = L.map('windMap').setView([0, 0], 2);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(windMap);
    },

    toggleTheme() {
        document.body.classList.toggle("dark-theme");
        themeToggle.textContent = document.body.classList.contains("dark-theme") ? "☀️" : "🌙";
        localStorage.setItem('theme', document.body.classList.contains("dark-theme") ? 'dark' : 'light');
    },

    loadUserLocation() {
        this.showLoading();
        this.hideError();
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    this.getWeatherData(currentLocation.latitude, currentLocation.longitude);
                    this.updateWindMap(currentLocation.latitude, currentLocation.longitude);
                    this.startAutoUpdate();
                },
                error => {
                    this.showError("Không thể truy cập vị trí của bạn. Vui lòng kiểm tra cài đặt quyền vị trí.");
                }
            );
        } else {
            this.showError("Trình duyệt của bạn không hỗ tr trợ định vị.");
        }
    },

    showLoading() {
        loadingElement.classList.remove("hidden");
        weatherContainer.classList.add("hidden");
        errorContainer.classList.add("hidden");
    },

    showWeather() {
        loadingElement.classList.add("hidden");
        weatherContainer.classList.remove("hidden");
        errorContainer.classList.add("hidden");
    },

    showError(message) {
        loadingElement.classList.add("hidden");
        weatherContainer.classList.add("hidden");
        errorContainer.classList.remove("hidden");
        document.getElementById("errorMessage").textContent = message;
        this.stopAutoUpdate();
    },

    hideError() {
        errorContainer.classList.add("hidden");
    },

    startAutoUpdate() {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
        updateInterval = setInterval(() => {
            if (isPageVisible && currentLocation) {
                this.getWeatherData(currentLocation.latitude, currentLocation.longitude);
            }
        }, 120000);
    },

    stopAutoUpdate() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    },

    async getWeatherData(lat, lon) {
        try {
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode,is_day,surface_pressure,visibility,wind_direction_10m&hourly=temperature_2m,weathercode,precipitation_probability,visibility,wind_speed_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto`;
            
            const [weatherResponse, airQualityResponse] = await Promise.all([
                fetch(weatherUrl),
                this.getAirQualityData(lat, lon)
            ]);
            
            if (!weatherResponse.ok) throw new Error("Network response was not ok");
            
            const weatherData = await weatherResponse.json();
            this.displayWeatherData(weatherData, airQualityResponse);
            this.showWeather();
            this.updateLastUpdateTime();
            
        } catch (error) {
            this.showError("Không thể tải dữ liệu thời tiết. Vui lòng thử lại sau.");
        }
    },

    async getAirQualityData(lat, lon) {
        try {
            const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`);
            if (!response.ok) throw new Error("Air quality data not available");
            return await response.json();
        } catch (error) {
            return null;
        }
    },

    displayWeatherData(data, airQualityData) {
        this.updateCurrentWeather(data);
        this.updateHourlyForecast(data);
        this.updateDailyForecast(data);
        this.updateAirQuality(airQualityData);
        this.updateCurrentDateTime();
    },

    updateCurrentWeather(data) {
        const current = data.current;
        const daily = data.daily;
        
        document.getElementById("locationName").textContent = "Vị trí của bạn";
        document.getElementById("currentTemp").textContent = `${Math.round(current.temperature_2m)}°C`;
        document.getElementById("weatherDescription").textContent = this.getWeatherDescription(current.weathercode);
        document.getElementById("weatherIcon").className = `wi ${this.getWeatherIcon(current.weathercode, current.is_day)} weather-icon`;
        
        document.getElementById("maxTemp").textContent = `${Math.round(daily.temperature_2m_max[0])}°`;
        document.getElementById("minTemp").textContent = `${Math.round(daily.temperature_2m_min[0])}°`;
        document.getElementById("feelsLike").textContent = `${Math.round(this.calculateFeelsLike(current.temperature_2m, current.relative_humidity_2m, current.wind_speed_10m))}°`;
        
        document.getElementById("humidityValue").textContent = `${current.relative_humidity_2m}%`;
        document.getElementById("windValue").textContent = `${current.wind_speed_10m} km/h`;
        document.getElementById("precipitationValue").textContent = `${data.hourly.precipitation_probability[0]}%`;
        document.getElementById("pressureValue").textContent = `${Math.round(current.surface_pressure)} hPa`;
        document.getElementById("visibilityValue").textContent = `${(current.visibility / 1000).toFixed(1)}`;
        document.getElementById("uvValue").textContent = `${Math.round(daily.uv_index_max[0])}`;
    },

    calculateFeelsLike(temp, humidity, windSpeed) {
        const heatIndex = this.calculateHeatIndex(temp, humidity);
        const windChill = this.calculateWindChill(temp, windSpeed);
        return (heatIndex + windChill) / 2;
    },

    calculateHeatIndex(temp, humidity) {
        if (temp < 27) return temp;
        
        const c1 = -8.78469475556;
        const c2 = 1.61139411;
        const c3 = 2.33854883889;
        const c4 = -0.14611605;
        const c5 = -0.012308094;
        const c6 = -0.0164248277778;
        const c7 = 0.002211732;
        const c8 = 0.00072546;
        const c9 = -0.000003582;
        
        return c1 + c2 * temp + c3 * humidity + c4 * temp * humidity +
               c5 * temp * temp + c6 * humidity * humidity +
               c7 * temp * temp * humidity + c8 * temp * humidity * humidity +
               c9 * temp * temp * humidity * humidity;
    },

    calculateWindChill(temp, windSpeed) {
        if (temp > 10) return temp;
        return 13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temp * Math.pow(windSpeed, 0.16);
    },

    updateHourlyForecast(data) {
        const hourly = data.hourly;
        const container = document.getElementById("hourlyForecast");
        container.innerHTML = "";
        
        const now = new Date();
        const currentHour = now.getHours();
        
        for (let i = 0; i < 24; i += 2) {
            const hourIndex = currentHour + i;
            if (hourIndex >= hourly.time.length) break;
            
            const time = new Date(hourly.time[hourIndex]);
            const temp = Math.round(hourly.temperature_2m[hourIndex]);
            const weatherCode = hourly.weathercode[hourIndex];
            const precipitation = hourly.precipitation_probability[hourIndex];
            const windSpeed = hourly.wind_speed_10m[hourIndex];
            
            const hourItem = document.createElement("div");
            hourItem.className = "hourly-item";
            hourItem.innerHTML = `
                <div class="hour-time">${this.formatTime(time)}</div>
                <i class="wi ${this.getWeatherIcon(weatherCode, 1)} hour-icon"></i>
                <div class="hour-temp">${temp}°</div>
                <div class="hour-precipitation">💧 ${precipitation}%</div>
                <div class="hour-precipitation">💨 ${windSpeed}km/h</div>
            `;
            
            container.appendChild(hourItem);
        }
    },

    updateDailyForecast(data) {
        const daily = data.daily;
        const container = document.getElementById("dailyForecast");
        container.innerHTML = "";
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(daily.time[i]);
            const dayName = this.getDayName(date);
            const maxTemp = Math.round(daily.temperature_2m_max[i]);
            const minTemp = Math.round(daily.temperature_2m_min[i]);
            const weatherCode = daily.weathercode[i];
            const precipitation = daily.precipitation_probability_max[i];
            const uvIndex = Math.round(daily.uv_index_max[i]);
            
            const dayItem = document.createElement("div");
            dayItem.className = "daily-item";
            dayItem.innerHTML = `
                <div class="day-info">
                    <div class="day-name">${i === 0 ? 'Hôm nay' : dayName}</div>
                    <i class="wi ${this.getWeatherIcon(weatherCode, 1)} day-icon"></i>
                    <div class="day-description">${this.getWeatherDescription(weatherCode)}</div>
                </div>
                <div class="day-temps">
                    <div class="day-precipitation">
                        <i class="wi wi-raindrop"></i>
                        <span class="precipitation-value">${precipitation}%</span>
                    </div>
                    <div class="day-precipitation">
                        <i class="wi wi-uv-index"></i>
                        <span>${uvIndex}</span>
                    </div>
                    <div>${maxTemp}° / ${minTemp}°</div>
                </div>
            `;
            
            container.appendChild(dayItem);
        }
    },

    updateAirQuality(data) {
        const container = document.getElementById("airQuality");
        
        if (!data || !data.current) {
            container.innerHTML = '<div class="aqi-loading">Dữ liệu chất lượng không khí không khả dụng</div>';
            return;
        }
        
        const aqi = data.current.us_aqi;
        const aqiLevel = this.getAQILevel(aqi);
        
        container.innerHTML = `
            <div class="aqi-card" style="background: ${aqiLevel.color}22; border: 1px solid ${aqiLevel.color}">
                <div class="aqi-label">Chỉ số AQI</div>
                <div class="aqi-value">${aqi}</div>
                <div class="aqi-label">${aqiLevel.level}</div>
            </div>
            <div class="aqi-card">
                <div class="aqi-label">Mức độ</div>
                <div class="aqi-value">${aqiLevel.quality}</div>
                <div class="aqi-label">${aqiLevel.description}</div>
            </div>
        `;
    },

    getAQILevel(aqi) {
        if (aqi <= 50) return {
            level: "Tốt",
            quality: "👍",
            color: "#00e400",
            description: "Chất lượng không khí tốt"
        };
        if (aqi <= 100) return {
            level: "Trung bình",
            quality: "😐",
            color: "#ffff00",
            description: "Chất lượng không khí chấp nhận được"
        };
        if (aqi <= 150) return {
            level: "Kém",
            quality: "😷",
            color: "#ff7e00",
            description: "Có thể ảnh hưởng đến nhóm nhạy cảm"
        };
        if (aqi <= 200) return {
            level: "Xấu",
            quality: "🤢",
            color: "#ff0000",
            description: "Ảnh hưởng đến sức khỏe"
        };
        if (aqi <= 300) return {
            level: "Rất xấu",
            quality: "😵",
            color: "#8f3f97",
            description: "Cảnh báo sức khỏe nghiêm trọng"
        };
        return {
            level: "Nguy hiểm",
            quality: "💀",
            color: "#7e0023",
            description: "Tình trạng khẩn cấp về sức khỏe"
        };
    },

    updateCurrentDateTime() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        document.getElementById("currentDateTime").textContent = now.toLocaleDateString('vi-VN', options);
    },

    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        lastUpdateElement.textContent = `Cập nhật: ${timeString}`;
    },

    updateWindMap(lat, lon) {
        windMap.setView([lat, lon], 7);
        
        L.marker([lat, lon])
            .addTo(windMap)
            .bindPopup('Vị trí của bạn')
            .openPopup();
        
        this.addWindLayer(lat, lon);
    },

    addWindLayer(lat, lon) {
        const windOverlay = L.rectangle([
            [lat - 2, lon - 2],
            [lat + 2, lon + 2]
        ], {
            color: "#ff7800",
            weight: 1,
            fillColor: "#ff7800",
            fillOpacity: 0.1
        }).addTo(windMap);
        
        for (let i = -2; i <= 2; i += 0.5) {
            for (let j = -2; j <= 2; j += 0.5) {
                const windSpeed = 10 + Math.random() * 20;
                const windDirection = Math.random() * 360;
                
                L.marker([lat + i, lon + j], {
                    icon: L.divIcon({
                        html: `<div style="transform: rotate(${windDirection}deg); color: ${this.getWindColor(windSpeed)}">→</div>`,
                        iconSize: [20, 20],
                        className: 'wind-arrow'
                    })
                }).addTo(windMap).bindPopup(`Gió: ${windSpeed.toFixed(1)} km/h`);
            }
        }
    },

    getWindColor(speed) {
        if (speed < 5) return '#ffffcc';
        if (speed < 15) return '#a1dab4';
        if (speed < 25) return '#41b6c4';
        if (speed < 40) return '#2c7fb8';
        return '#253494';
    },

    getWeatherIcon(code, isDay) {
        const iconMap = {
            0: isDay ? "wi-day-sunny" : "wi-night-clear",
            1: isDay ? "wi-day-sunny-overcast" : "wi-night-alt-partly-cloudy",
            2: isDay ? "wi-day-cloudy" : "wi-night-alt-cloudy",
            3: "wi-cloudy",
            45: "wi-fog",
            48: "wi-fog",
            51: "wi-sprinkle",
            53: "wi-sprinkle",
            55: "wi-sprinkle",
            61: "wi-rain",
            63: "wi-rain",
            65: "wi-rain",
            66: "wi-rain-mix",
            67: "wi-rain-mix",
            71: "wi-snow",
            73: "wi-snow",
            75: "wi-snow",
            77: "wi-snowflake-cold",
            80: "wi-showers",
            81: "wi-showers",
            82: "wi-showers",
            85: "wi-snow-wind",
            86: "wi-snow-wind",
            95: "wi-thunderstorm",
            96: "wi-thunderstorm",
            99: "wi-thunderstorm"
        };
        
        return iconMap[code] || "wi-na";
    },

    getWeatherDescription(code) {
        const descriptions = {
            0: "Trời quang",
            1: "Chủ yếu trời quang",
            2: "Có mây rải rác",
            3: "Nhiều mây",
            45: "Sương mù",
            48: "Sương mù",
            51: "Mưa phùn nhẹ",
            53: "Mưa phùn vừa",
            55: "Mưa phùn dày đặc",
            61: "Mưa nhẹ",
            63: "Mưa vừa",
            65: "Mưa nặng hạt",
            66: "Mưa đá nhẹ",
            67: "Mưa đá nặng hạt",
            71: "Tuyết rơi nhẹ",
            73: "Tuyết rơi vừa",
            75: "Tuyết rơi nặng hạt",
            77: "Hạt tuyết",
            80: "Mưa rào nhẹ",
            81: "Mưa rào vừa",
            82: "Mưa rào nặng hạt",
            85: "Tuyết rơi nhẹ",
            86: "Tuyết rơi nặng hạt",
            95: "Dông",
            96: "Dông kèm mưa đá nhẹ",
            99: "Dông kèm mưa đá nặng hạt"
        };
        
        return descriptions[code] || "Không xác định";
    },

    formatTime(date) {
        return date.getHours().toString().padStart(2, '0') + ':00';
    },

    getDayName(date) {
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        return days[date.getDay()];
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.textContent = '☀️';
    }
    
    WeatherManager.init();
});

window.addEventListener('beforeunload', () => {
    WeatherManager.stopAutoUpdate();
});