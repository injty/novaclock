"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
function activate(context) {
    let interval;
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.tooltip = 'Нажмите, чтобы настроить часы';
    statusBar.command = 'novaclock.configure';
    statusBar.show();
    const getSettings = () => {
        const config = vscode.workspace.getConfiguration('novaclock');
        const settings = config.get('settings', {});
        return {
            use24HourFormat: settings.use24HourFormat ?? true,
            locale: settings.locale ?? 'default',
            icon: settings.icon ?? '🕒',
            textColor: settings.textColor ?? '#ffffff',
            showSeconds: settings.showSeconds ?? true,
        };
    };
    const updateClock = () => {
        const { use24HourFormat, locale, icon, textColor, showSeconds } = getSettings();
        const now = new Date();
        const timeString = now.toLocaleTimeString(locale === 'default' ? undefined : locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: showSeconds ? '2-digit' : undefined,
            hour12: !use24HourFormat,
        });
        statusBar.text = `${timeString} ${icon}`;
        statusBar.color = textColor;
    };
    const startClock = () => {
        stopClock();
        updateClock();
        const now = new Date();
        const msToNextSecond = 1000 - now.getMilliseconds();
        setTimeout(() => {
            updateClock();
            interval = setInterval(updateClock, 1000);
        }, msToNextSecond);
    };
    const stopClock = () => {
        if (interval) {
            clearInterval(interval);
            interval = undefined;
        }
    };
    startClock();
    vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('novaclock.settings')) {
            startClock();
        }
    });
    const configureClockCommand = vscode.commands.registerCommand('novaclock.configure', async () => {
        const config = vscode.workspace.getConfiguration('novaclock');
        const settings = config.get('settings', {});
        const choice = await vscode.window.showQuickPick([
            'Переключить 12/24 формат',
            'Показать/скрыть секунды',
            'Изменить локаль',
            'Изменить цвет текста',
            'Изменить иконку',
        ], { placeHolder: 'Выберите, что изменить' });
        if (!choice)
            return;
        switch (choice) {
            case 'Переключить 12/24 формат': {
                await config.update('settings', {
                    ...settings,
                    use24HourFormat: !settings.use24HourFormat,
                }, vscode.ConfigurationTarget.Global);
                break;
            }
            case 'Показать/скрыть секунды': {
                await config.update('settings', {
                    ...settings,
                    showSeconds: !settings.showSeconds,
                }, vscode.ConfigurationTarget.Global);
                break;
            }
            case 'Изменить локаль': {
                const input = await vscode.window.showInputBox({
                    prompt: 'Введите локаль (например, ru-RU, en-US)',
                    placeHolder: 'default',
                });
                if (input !== undefined) {
                    await config.update('settings', {
                        ...settings,
                        locale: input.trim() || 'default',
                    }, vscode.ConfigurationTarget.Global);
                }
                break;
            }
            case 'Изменить цвет текста': {
                const input = await vscode.window.showInputBox({
                    prompt: 'Введите HEX цвет (например, #ffffff)',
                    placeHolder: '#ffffff',
                });
                if (input) {
                    await config.update('settings', {
                        ...settings,
                        textColor: input,
                    }, vscode.ConfigurationTarget.Global);
                }
                break;
            }
            case 'Изменить иконку': {
                const input = await vscode.window.showInputBox({
                    prompt: 'Введите эмоджи (например, 🕘, ⏰, ⌚)',
                    placeHolder: '🕒',
                });
                if (input) {
                    await config.update('settings', {
                        ...settings,
                        icon: input,
                    }, vscode.ConfigurationTarget.Global);
                }
                break;
            }
        }
    });
    context.subscriptions.push(statusBar, configureClockCommand, {
        dispose: stopClock,
    });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map