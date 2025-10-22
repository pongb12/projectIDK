const weatherContainer = document.getElementById("weatherContainer");
const loadingElement = document.getElementById("loading");
const errorContainer = document.getElementById("errorContainer");
const currentLocationBtn = document.getElementById("currentLocationBtn");
const themeToggle = document.getElementById("themeToggle");
const retryBtn = document.getElementById("retryBtn");

let weatherMap = null;
let currentLocation = null;

function initializeApp() {
  setupEventListeners();
  initializeMap();
  loadUserLocation();
}

function setupEventListeners() {
  currentLocationBtn.addEventListener("click", loadUserLocation);
  themeToggle.addEventListener("click", toggleTheme);
  retryBtn.addEventListener("click", loadUserLocation);
}

function initializeMap() {
  weatherMap = L.map('weatherMap').setView([0, 0], 2);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(weatherMap);
}

function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  themeToggle.textContent = document.body.classList.contains("dark-theme") ? "☀️" : "🌙";
}

function loadUserLocation() {
  showLoading();
  hideError();
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        getWeatherData(currentLocation.latitude, currentLocation.longitude);
        updateMapPosition(currentLocation.latitude, currentLocation.longitude);
      },
      error => {
        showError("Không thể truy cập vị trí của bạn. Vui lòng kiểm tra cài đặt quyền vị trí.");
      }
    );
  } else {
    showError("Trình duyệt của bạn không hỗ trợ định vị.");
  }
}

function showLoading() {
  loadingElement.classList.remove("hidden");
  weatherContainer.classList.add("hidden");
  errorContainer.classList.add("hidden");
}

function showWeather() {
  loadingElement.classList.add("hidden");
  weatherContainer.classList.remove("hidden");
  errorContainer.classList.add("hidden");
}

function showError(message) {
  loadingElement.classList.add("hidden");
  weatherContainer.classList.add("hidden");
  errorContainer.classList.remove("hidden");
  document.getElementById("errorMessage").textContent = message;
}

function hideError() {
  errorContainer.classList.add("hidden");
}

async function getWeatherData(lat, lon) {
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode,is_day,surface_pressure&hourly=temperature_2m,weathercode,precipitation_probability&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    
    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error("Network response was not ok");
    
    const data = await response.json();
    displayWeatherData(data);
    showWeather();
  } catch (error) {
    showError("Không thể tải dữ liệu thời tiết. Vui lòng thử lại sau.");
  }
}

function displayWeatherData(data) {
  updateCurrentWeather(data);
  updateHourlyForecast(data);
  updateDailyForecast(data);
  updateCurrentDateTime();
}

function updateCurrentWeather(data) {
  const current = data.current;
  const daily = data.daily;
  
  document.getElementById("locationName").textContent = "Vị trí của bạn";
  document.getElementById("currentTemp").textContent = `${Math.round(current.temperature_2m)}°C`;
  document.getElementById("weatherDescription").textContent = getWeatherDescription(current.weathercode);
  document.getElementById("weatherIcon").className = `wi ${getWeatherIcon(current.weathercode, current.is_day)} weather-icon`;
  
  document.getElementById("maxTemp").textContent = `${Math.round(daily.temperature_2m_max[0])}°`;
  document.getElementById("minTemp").textContent = `${Math.round(daily.temperature_2m_min[0])}°`;
  
  document.getElementById("humidityValue").textContent = `${current.relative_humidity_2m}%`;
  document.getElementById("windValue").textContent = `${current.wind_speed_10m} km/h`;
  document.getElementById("precipitationValue").textContent = `${data.hourly.precipitation_probability[0]}%`;
  document.getElementById("pressureValue").textContent = `${Math.round(current.surface_pressure)} hPa`;
}

function updateHourlyForecast(data) {
  const hourly = data.hourly;
  const container = document.getElementById("hourlyForecast");
  container.innerHTML = "";
  
  const now = new Date();
  const currentHour = now.getHours();
  
  for (let i = 0; i < 24; i += 3) {
    const hourIndex = currentHour + i;
    if (hourIndex >= hourly.time.length) break;
    
    const time = new Date(hourly.time[hourIndex]);
    const temp = Math.round(hourly.temperature_2m[hourIndex]);
    const weatherCode = hourly.weathercode[hourIndex];
    const precipitation = hourly.precipitation_probability[hourIndex];
    
    const hourItem = document.createElement("div");
    hourItem.className = "hourly-item";
    hourItem.innerHTML = `
      <div class="hour-time">${formatTime(time)}</div>
      <i class="wi ${getWeatherIcon(weatherCode, 1)} hour-icon"></i>
      <div class="hour-temp">${temp}°</div>
      <div class="hour-precipitation">💧 ${precipitation}%</div>
    `;
    
    container.appendChild(hourItem);
  }
}

function updateDailyForecast(data) {
  const daily = data.daily;
  const container = document.getElementById("dailyForecast");
  container.innerHTML = "";
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(daily.time[i]);
    const dayName = getDayName(date);
    const maxTemp = Math.round(daily.temperature_2m_max[i]);
    const minTemp = Math.round(daily.temperature_2m_min[i]);
    const weatherCode = daily.weathercode[i];
    const precipitation = daily.precipitation_probability_max[i];
    
    const dayItem = document.createElement("div");
    dayItem.className = "daily-item";
    dayItem.innerHTML = `
      <div class="day-info">
        <div class="day-name">${i === 0 ? 'Hôm nay' : dayName}</div>
        <i class="wi ${getWeatherIcon(weatherCode, 1)} day-icon"></i>
        <div class="day-description">${getWeatherDescription(weatherCode)}</div>
      </div>
      <div class="day-temps">
        <div class="day-precipitation">
          <i class="wi wi-raindrop"></i>
          <span class="precipitation-value">${precipitation}%</span>
        </div>
        <div>${maxTemp}° / ${minTemp}°</div>
      </div>
    `;
    
    container.appendChild(dayItem);
  }
}

function updateCurrentDateTime() {
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
}

function updateMapPosition(lat, lon) {
  weatherMap.setView([lat, lon], 10);
  
  L.marker([lat, lon])
    .addTo(weatherMap)
    .bindPopup('Vị trí của bạn')
    .openPopup();
}

function getWeatherIcon(code, isDay) {
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
}

function getWeatherDescription(code) {
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
}

function formatTime(date) {
  return date.getHours().toString().padStart(2, '0') + ':00';
}

function getDayName(date) {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return days[date.getDay()];
}

document.addEventListener('DOMContentLoaded', initializeApp);