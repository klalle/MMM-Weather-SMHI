/* global Module, Log, moment, config */

/* Magic Mirror
 * Module: MMM-Weather-SMHI
 * By Fredrick Bäcker, updated by community
 * MIT Licensed.
 */

Module.register("MMM-Weather-SMHI", {
	// Default module config.
	defaults: {
		url: "http://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/%s/lat/%s/data.json",
		lon: 0,
		lat: 0,
		useBeaufort: true,
		showWindDirection: false,
		windDirectionMode: 0, // 0 = text, 1 = icon
		showDailyWindInfo: false,
		showDailyRainInfo: false,
		tempDecimals: 1,
		units: config.units,
		maxNumberOfDays: 5,
		updateInterval: 10 * 60 * 1000, // every 10 minutes
		animationSpeed: 1000,
		timeFormat: config.timeFormat,
		lang: config.language,
		fade: true,
		fadePoint: 0.25, // Start on 1/4th of the list.
		title: "Väderprognos",
		initialLoadDelay: 2500, // 2.5 seconds delay
		retryDelay: 2500,
		wdirDegreeToText: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW", "N"],
		iconTable: {
			1: ["wi-day-sunny", "wi-night-clear"], // Clear sky
			2: ["wi-day-sunny-overcast", "wi-night-partly-cloudy"], // Nearly clear sky
			3: ["wi-day-cloudy", "wi-night-alt-cloudy"], // Variable cloudiness
			4: ["wi-day-cloudy", "wi-night-alt-cloudy"], // Halfclear sky
			5: ["wi-day-cloudy", "wi-night-alt-cloudy"], // Cloudy sky
			6: ["wi-cloudy", "wi-cloudy"], // Overcast
			7: ["wi-day-fog", "wi-night-fog"], // Fog
			8: ["wi-day-showers", "wi-night-alt-showers"], // Light rain showers
			9: ["wi-day-showers", "wi-night-alt-showers"], // Moderate rain showers
			10: ["wi-day-showers", "wi-night-alt-showers"], // Heavy rain showers
			11: ["wi-day-thunderstorm", "wi-night-alt-thunderstorm"], // Thunderstorm
			12: ["wi-day-sleet", "wi-night-alt-sleet"], // Light sleet showers
			13: ["wi-day-sleet", "wi-night-alt-sleet"], // Moderate sleet showers
			14: ["wi-day-sleet", "wi-night-alt-sleet"], // Heavy sleet showers
			15: ["wi-day-snow", "wi-night-alt-snow"], // Light snow showers
			16: ["wi-day-snow", "wi-night-alt-snow"], // Moderate snow showers
			17: ["wi-day-snow", "wi-night-alt-snow"], // Heavy snow showers
			18: ["wi-day-rain", "wi-night-alt-rain"], // Light rain
			19: ["wi-day-rain", "wi-night-alt-rain"], // Moderate rain
			20: ["wi-day-rain", "wi-night-alt-rain"], // Heavy rain
			21: ["wi-day-lightning", "wi-night-alt-lightning"], // Thunder
			22: ["wi-day-sleet", "wi-night-alt-sleet"], // Light sleet
			23: ["wi-day-sleet", "wi-night-alt-sleet"], // Moderate sleet
			24: ["wi-day-sleet", "wi-night-alt-sleet"], // Heavy sleet
			25: ["wi-day-snow", "wi-night-alt-snow"], // Light snowfall
			26: ["wi-day-snow", "wi-night-alt-snow"], // Moderate snowfall
			27: ["wi-day-snow", "wi-night-alt-snow"] // Heavy snowfall
		}
	},

	getScripts: function () {
		return ["moment.js"];
	},

	getStyles: function () {
		return ["weather-icons.css", "weather-icons-wind.css", "MMM-Weather-SMHI.css"];
	},

	getTranslations: function () {
		return false;
	},

	stringFormat: function (theString, argumentArray) {
		let regex = /%s/;
		let _r = function (p, c) {
			return p.replace(regex, c);
		};
		return argumentArray.reduce(_r, theString);
	},

	start: function () {
		Log.info("Starting module: " + this.name);
		moment.locale(config.language);

		this.forecast = [];
		this.current = null;
		this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay);
		this.updateTimer = null;
	},

	getDom: function () {
		const wrapper = document.createElement("div");

		if (this.config.lon === "" || this.config.lon === 0) {
			wrapper.innerHTML = "Please set the MMM-Weather-SMHI <i>lon</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (this.config.lat === "" || this.config.lat === 0) {
			wrapper.innerHTML = "Please set the MMM-Weather-SMHI <i>lat</i> in the config for module: " + this.name + ".";
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		if (!this.loaded) {
			wrapper.innerHTML = this.translate("LOADING");
			wrapper.className = "dimmed light small";
			return wrapper;
		}

		// CURRENT WEATHER
		const small = document.createElement("span");
		small.className = "normal medium";

		const windIcon = document.createElement("span");
		windIcon.className = "wi wi-strong-wind dimmed";
		small.appendChild(windIcon);

		let speed = this.current.wind;
		if (this.config.useBeaufort) {
			speed = this.ms2Beaufort(this.roundValue(speed));
		} else {
			speed = parseFloat(speed).toFixed(0);
		}
		const windSpeed = document.createElement("span");
		windSpeed.innerHTML = " " + speed;
		const windSpeedMark = document.createElement("sup");
		windSpeedMark.innerHTML = this.config.useBeaufort ? "b" : "s";
		small.appendChild(windSpeed);
		small.appendChild(windSpeedMark);

		if (this.config.showWindDirection) {
			if (this.config.windDirectionMode === 0) {
				const windDirection = document.createElement("sup");
				windDirection.innerHTML = " " + this.deg2Cardinal(this.current.direction);
				small.appendChild(windDirection);
			} else {
				const windDirection = document.createElement("span");
				windDirection.className = "wi wi-wind from-" + parseFloat(this.current.direction).toFixed(0) + "-deg";
				small.appendChild(windDirection);
			}
		}
		const spacer = document.createElement("span");
		spacer.innerHTML = " ";
		small.appendChild(spacer);

		const large = document.createElement("div");
		large.className = "large light";

		const weatherIcon = document.createElement("span");
		weatherIcon.className = "bright wi weather-icon-large " + this.current.icon;
		large.appendChild(weatherIcon);

		const temperature = document.createElement("span");
		temperature.className = "bright";
		temperature.innerHTML = " " + this.current.temp + "°";
		large.appendChild(temperature);

		large.insertBefore(small, weatherIcon);
		wrapper.appendChild(large);

		// FORECAST TABLE
		const table = document.createElement("table");
		table.className = "small";

		for (const f in this.forecast) {
			const forecast = this.forecast[f];
			const row = document.createElement("tr");
			table.appendChild(row);

			const dayCell = document.createElement("td");
			dayCell.className = "day";
			dayCell.innerHTML = forecast.day;
			row.appendChild(dayCell);

			const maxTempCell = document.createElement("td");
			maxTempCell.className = "temp-daily bright";
			maxTempCell.innerHTML = forecast.maxTemp + "°";
			row.appendChild(maxTempCell);

			let iconCell = document.createElement("td");
			iconCell.className = "bright weather-icon";
			row.appendChild(iconCell);

			let icon = document.createElement("span");
			icon.className = "wi weathericon " + forecast.dayIcon;
			iconCell.appendChild(icon);

			const minTempCell = document.createElement("td");
			minTempCell.className = "temp-daily";
			minTempCell.innerHTML = forecast.minTemp + "°";
			row.appendChild(minTempCell);

			iconCell = document.createElement("td");
			iconCell.className = "weather-icon";
			row.appendChild(iconCell);

			icon = document.createElement("span");
			icon.className = "wi weathericon " + forecast.nightIcon;
			iconCell.appendChild(icon);

			if (this.config.showDailyWindInfo) {
				const windSpeedCell = document.createElement("td");
				windSpeedCell.className = "windspeed-daily";

				let speed = forecast.dayWind;
				if (this.config.useBeaufort) {
					speed = this.ms2Beaufort(this.roundValue(speed));
				} else {
					speed = parseFloat(speed).toFixed(0);
				}
				windSpeedCell.innerHTML = " " + speed;

				const windSpeedMark = document.createElement("sup");
				windSpeedMark.innerHTML = this.config.useBeaufort ? "b" : "s";
				windSpeedCell.appendChild(windSpeedMark);
				row.appendChild(windSpeedCell);

				if (this.config.showWindDirection) {
					const windDirCell = document.createElement("td");
					windDirCell.className = "direction-daily";
					if (this.config.windDirectionMode === 0) {
						const windDirection = document.createElement("sup");
						windDirection.innerHTML = " " + this.deg2Cardinal(forecast.dayDirection);
						windDirCell.appendChild(windDirection);
					} else {
						const windDirection = document.createElement("span");
						windDirection.className = "wi wi-wind from-" + parseFloat(forecast.dayDirection).toFixed(0) + "-deg";
						windDirCell.appendChild(windDirection);
					}
					row.appendChild(windDirCell);
				}
			}

			if (this.config.showDailyRainInfo) {
				const rainCell = document.createElement("td");
				rainCell.className = "rain-daily";

				// *** MODIFICATION: Only show rain if it's more than 0 ***
				const rainAmount = parseFloat(forecast.totalRain).toFixed(1);
				if (rainAmount > 0.0) {
					const rainUnitMark = document.createElement("span");
					rainUnitMark.className = "mm-unit";
					rainUnitMark.innerHTML = "mm";
					rainCell.innerHTML = " " + rainAmount;
					rainCell.appendChild(rainUnitMark);
				} else {
					rainCell.innerHTML = " "; // Show empty space instead of "0.0mm"
				}
				row.appendChild(rainCell);
			}

			if (this.config.fade && this.config.fadePoint < 1) {
				if (this.config.fadePoint < 0) {
					this.config.fadePoint = 0;
				}
				const startingPoint = this.forecast.length * this.config.fadePoint;
				const steps = this.forecast.length - startingPoint;
				if (f >= startingPoint) {
					const currentStep = f - startingPoint;
					row.style.opacity = 1 - (1 / steps) * currentStep;
				}
			}
		}

		const header = document.createElement("header");
		header.innerHTML = this.config.title;
		wrapper.appendChild(header);
		wrapper.appendChild(table);

		return wrapper;
	},

	updateWeather: function () {
		const url = this.stringFormat(this.config.url, [this.config.lon.toFixed(4), this.config.lat.toFixed(4)]);
		const self = this;
		let retry = true;

		const weatherRequest = new XMLHttpRequest();
		weatherRequest.open("GET", url, true);
		weatherRequest.onreadystatechange = function () {
			if (this.readyState === 4) {
				if (this.status === 200) {
					self.processWeather(JSON.parse(this.response));
				} else if (this.status === 401) {
					self.updateDom(self.config.animationSpeed);
					Log.error(self.name + ": Credentials error. Check API key if required.");
					retry = false;
				} else {
					Log.error(self.name + ": Could not load weather.");
				}

				if (retry) {
					self.scheduleUpdate(self.loaded ? -1 : self.config.retryDelay);
				}
			}
		};
		weatherRequest.send();
	},

	// Finds the true min/max temperature for each day instead of using noon/midnight as a proxy.
	processWeather: function (data) {
		this.forecast = [];
		this.current = null;
		let closest = 50000;
		const dailyData = {};

		// First, find the current weather (closest forecast to now)
		for (const forecast of data.timeSeries) {
			const item = this.createParsedItem(forecast);
			const timeFromNow = Math.abs(item.time.diff(moment(), "minutes"));
			if (timeFromNow < closest) {
				closest = timeFromNow;
				this.current = item;
				// Set current icon (day/night based on current time)
				const isDay = moment().isBetween(moment().startOf('day').add(6, 'hours'), moment().startOf('day').add(20, 'hours'));
				this.current.icon = this.config.iconTable[this.current.icon_raw][isDay ? 0 : 1];
			}
		}

		// Next, process all forecasts to find daily min/max/rain
		for (const forecast of data.timeSeries) {
			const item = this.createParsedItem(forecast);

			// Stop if we have reached the max number of days
			if (item.time.diff(moment().endOf("day"), "days") >= this.config.maxNumberOfDays) {
				break;
			}

			const dayKey = item.time.format("YYYY-MM-DD");

			// If it's the first entry for this day, initialize it
			if (!dailyData[dayKey]) {
				dailyData[dayKey] = {
					day: item.day,
					maxTemp: -100,
					minTemp: 100,
					totalRain: 0,
					maxTempItem: null, // Store the full item for max temp
					minTempItem: null // Store the full item for min temp
				};
			}

			// Aggregate data for the day
			dailyData[dayKey].totalRain += item.rain;

			if (item.temp > dailyData[dayKey].maxTemp) {
				dailyData[dayKey].maxTemp = item.temp;
				dailyData[dayKey].maxTempItem = item;
			}

			if (item.temp < dailyData[dayKey].minTemp) {
				dailyData[dayKey].minTemp = item.temp;
				dailyData[dayKey].minTempItem = item;
			}
		}

		// Now, build the final forecast array from the aggregated data
		for (const dayKey in dailyData) {
			const day = dailyData[dayKey];
			// Ensure we have valid data before pushing
			if (day.maxTempItem && day.minTempItem) {
				this.forecast.push({
					day: day.day,
					maxTemp: day.maxTemp.toFixed(this.config.tempDecimals),
					minTemp: day.minTemp.toFixed(this.config.tempDecimals),
					totalRain: day.totalRain,
					dayIcon: this.config.iconTable[day.maxTempItem.icon_raw][0], // Use day icon
					nightIcon: this.config.iconTable[day.minTempItem.icon_raw][1], // Use night icon for min temp
					dayWind: day.maxTempItem.wind,
					dayDirection: day.maxTempItem.direction
				});
			}
		}

		this.loaded = true;
		this.updateDom(this.config.animationSpeed);
	},

	// Helper function to parse a single forecast entry from SMHI
	createParsedItem: function(forecastData) {
		return {
			time: moment(forecastData.validTime),
			day: moment(forecastData.validTime).format("ddd"),
			icon_raw: this.getParameterValue("Wsymb2", forecastData), // Raw weather symbol code
			temp: parseFloat(this.getParameterValue("t", forecastData)),
			wind: parseFloat(this.getParameterValue("ws", forecastData)),
			direction: parseFloat(this.getParameterValue("wd", forecastData)),
			rain: parseFloat(this.getParameterValue("pmean", forecastData)),
			cloud: parseFloat(this.getParameterValue("tcc_mean", forecastData))
		};
	},

	// Helper function to get a specific parameter from the SMHI data structure
	getParameterValue(name, data) {
		const param = data.parameters.find(p => p.name === name);
		return param ? param.values[0] : null;
	},
	// *** END OF MAJOR REWRITE ***

	scheduleUpdate: function (delay) {
		let nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		clearTimeout(this.updateTimer);
		this.updateTimer = setTimeout(() => {
			this.updateWeather();
		}, nextLoad);
	},

	ms2Beaufort: function (ms) {
		const kmh = ms * 3.6;
		const speeds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117, 1000];
		for (const beaufort in speeds) {
			if (speeds[beaufort] > kmh) {
				return beaufort;
			}
		}
		return 12;
	},

	deg2Cardinal: function (deg) {
		return this.config.wdirDegreeToText[Math.round((deg % 360) / 22.5) % 16];
	},

	roundValue: function (value) {
		return parseFloat(value).toFixed(1);
	}
});
