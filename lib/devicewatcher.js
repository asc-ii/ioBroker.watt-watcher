class DeviceWatcher {
	/**
	 * @param {object} adapter - the ioBroker adapter instance (this)
	 * @param {ioBroker.AdapterConfig} config - config for this watcher
	 */
	constructor(adapter, config) {
		this.adapter = adapter;
		this.config = config;

		this._timer = null;
		this._counterOn = 0;
		this._counterOff = 0;
		this._running = false;
		this._finished = false;
	}

	/** Start polling loop */
	async start() {
		const intervalMs = Math.max(1000, (this.config.intervalSeconds || 10) * 1000);
		if (this._timer) {
			clearInterval(this._timer);
		}
		this._timer = setInterval(() => this._loop(), intervalMs);
		this.adapter.log.info(`"${this.config.name}" started (interval ${intervalMs / 1000} secs)`);
		await this._updateState('idle');
	}

	/** Stop polling loop */
	stop() {
		if (this._timer) {
			clearInterval(this._timer);
			this._timer = null;
		}
		this.adapter.log.info(`"${this.config.name}" stopped`);
	}

	/** Clean up */
	async dispose() {
		this.stop();
	}

	/** Core loop executed every interval */
	async _loop() {
		try {
			const powerStateId = this.config.powerStateId;
			const switchStateId = this.config.switchStateId;

			// read states (use 0 if missing)
			const powerState = powerStateId ? await this.adapter.getForeignStateAsync(powerStateId) : null;
			const switchState = switchStateId ? await this.adapter.getForeignStateAsync(switchStateId) : null;

			const currentPower = Number((powerState && powerState.val) || 0);
			const plugOn = Boolean(
				switchState && (switchState.val === true || switchState.val === 'true' || switchState.val === 1),
			);

			// counting logic
			if (currentPower > this.config.startThresholdWatt) {
				this._counterOn += 1;
				this._counterOff = 0;
			} else if (currentPower < this.config.stopThresholdWatt && plugOn) {
				this._counterOff += 1;
				this._counterOn = 0;
			} else {
				// neither above start nor below stop (e.g. medium load): don't change counters
			}

			// detect start
			if (!this._running && this._counterOn >= this.config.startCounterLimit) {
				this._running = true;
				this._finished = false;
				this.adapter.log.info(`${this.config.name} started`);
				await this._updateState('running');
				await this._setTimestamp('lastStart');
			}

			// detect finished
			if (this._running && this._counterOff >= this.config.stopCounterLimit) {
				this._running = false;
				this._finished = true;
				this.adapter.log.info(`${this.config.name} finished`);
				await this._updateState('finished');
				await this._setTimestamp('lastEnd');
			}

			// optional auto-off after finished and enough off-count
			if (
				plugOn &&
				this._finished &&
				this.config.switchOffAfterFinished &&
				this._counterOff >= this.config.autoOffCounterLimit &&
				switchStateId
			) {
				try {
					this.adapter.log.info(`${this.config.name}: auto-off triggered, switching off ${switchStateId}`);
					await this.adapter.setForeignStateAsync(switchStateId, false, false); // do not ack the change
					this._counterOff = 0;
				} catch (err) {
					this.adapter.log.warn(`${this.config.name}: failed to auto-off: ${err}`);
				}
			}

			// if plug is off, optionally reset internal state after resetDelay
			if (!plugOn && this._running === false) {
				// immediate reset of counters and finished state; you can implement a timed reset if you prefer
				if (this._finished) {
					// keep finished true if you want; here we reset to idle when plug is off
					this._finished = false;
					await this._updateState('idle');
				}
				this._counterOff = 0;
				this._counterOn = 0;
			}

			// update currentPower state for UI
			await this._updateCurrentPower(currentPower);
		} catch (err) {
			this.adapter.log.error(`${this.config.name}: error in loop: ${err}`);
		}
	}

	/** Ensure states exist and set status (idle | running | finished) */
	async _updateState(status) {
		const statusId = `status`;
		this.adapter.log.info(`${this.config.name}: update status to ${status}`);
		try {
			// await this.adapter.setObjectNotExistsAsync(statusId, {
			// 	type: 'state',
			// 	common: {
			// 		name: `status`,
			// 		type: 'string',
			// 		role: 'indicator.state',
			// 		read: true,
			// 		write: false,
			// 	},
			// 	native: {},
			// });
			await this.adapter.setStateAsync(statusId, { val: status, ack: true });
		} catch (err) {
			this.adapter.log.warn(`${this.config.name}: could not update status: ${err}`);
		}
	}

	/** Write current power to a state for UI */
	async _updateCurrentPower(power) {
		const powerId = `currentPower`;
		try {
			// await this.adapter.setObjectNotExistsAsync(powerId, {
			// 	type: 'state',
			// 	common: {
			// 		name: `${this.config.name} current power (W)`,
			// 		type: 'number',
			// 		role: 'value.power',
			// 		unit: 'W',
			// 		read: true,
			// 		write: false,
			// 	},
			// 	native: {},
			// });
			await this.adapter.setStateAsync(powerId, { val: Number(power), ack: true });
		} catch (err) {
			this.adapter.log.warn(`${this.config.name}: could not update currentPower: ${err}`);
		}
	}

	/** Set timestamps like lastStart / lastEnd */
	async _setTimestamp(key) {
		const tsId = `${key}`;
		const timestamp = Date.now();
		try {
			// await this.adapter.setObjectNotExistsAsync(tsId, {
			// 	type: 'state',
			// 	common: {
			// 		name: `${this.config.name} ${key}`,
			// 		type: 'number',
			// 		role: 'value.timestamp',
			// 		read: true,
			// 		write: false,
			// 	},
			// 	native: {},
			// });
			await this.adapter.setStateAsync(tsId, { val: timestamp, ack: true });
		} catch (err) {
			this.adapter.log.warn(`${this.config.name}: could not set timestamp ${key}: ${err}`);
		}
	}
}

module.exports = DeviceWatcher;
