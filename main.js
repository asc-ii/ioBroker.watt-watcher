'use strict';

/*
 * Created with @iobroker/create-adapter v2.6.5
 */

const utils = require('@iobroker/adapter-core');
const DeviceWatcher = require('./lib/devicewatcher');
const validateDeviceConfig = require('./lib/utils');

/*
interface DeviceWatcherConfig {
    name: string;                         // Anzeigename
    powerStateId: string;                  // z.B. fritzdect.0.DECT_116300369609.power
    switchStateId: string;                 // z.B. fritzdect.0.DECT_116300369609.state
    intervalSeconds: number;               // Abtastintervall (z.B. 10)
    startThresholdWatt: number;            // z.B. 30
    stopThresholdWatt: number;             // z.B. 5
    startCounterLimit: number;             // Intervalle > startThreshold für "läuft"
    stopCounterLimit: number;              // Intervalle < stopThreshold für "fertig"
    autoOffCounterLimit: number;           // Intervalle bis Auto-Off
    switchOffAfterFinished: boolean;       // Soll nach Ende abgeschaltet werden?
    resetDelayMinutes: number;             // Optional: nach wieviel Minuten zurück auf idle
}
*/

class WattWatcher extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'watt-watcher',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));

		this.watcher = null;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here
		if (!validateDeviceConfig(this, this.config)) {
			this.log.error(`Aborting due to configuration errors.`);
			return;
		}

		this.watcher = new DeviceWatcher(this, this.config);
		await this.watcher.start();
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.watcher) {
				this.watcher.stop();
				this.watcher = null;
			}

			callback();
		} catch (_e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new WattWatcher(options);
} else {
	// otherwise start the instance directly
	new WattWatcher();
}
