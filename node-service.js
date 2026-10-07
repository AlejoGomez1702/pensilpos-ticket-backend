const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
    name: 'Pensilpos Ticket Service',
    description: 'Backend service for Pensilpos Ticket system',
    script: path.join(__dirname, 'src', 'app.js'),
    // Configuración de auto-inicio
    nodeOptions: [
        '--harmony',
        '--max_old_space_size=4096'
    ],
    // Auto-reinicio en caso de fallo
    maxRestarts: 5,
    maxRetries: 3,
    wait: 2,
    grow: 0.5,
    // Directorio de trabajo
    workingDirectory: __dirname
});

// Event listeners
svc.on('install', () => {
    svc.start();
    console.log('✓ Service installed and started successfully.');
    console.log('✓ Service name: Pensilpos Ticket Service');
});

svc.on('alreadyinstalled', () => {
    console.log('⚠ Service is already installed.');
});

svc.on('uninstall', () => {
    console.log('✓ Service uninstalled successfully.');
});

svc.on('start', () => {
    console.log('✓ Service started.');
});

svc.on('stop', () => {
    console.log('✓ Service stopped.');
});

svc.on('error', (error) => {
    console.error('✗ Error:', error);
});

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Command handlers
switch (command) {
    case '--install':
    case '-i':
        console.log('Installing service...');
        svc.install();
        break;

    case '--uninstall':
    case '-u':
        console.log('Uninstalling service...');
        svc.uninstall();
        break;

    case '--help':
    case '-h':
    default:
        console.log('\n=== Pensilpos Ticket Service Manager ===\n');
        console.log('Usage: node node-service.js [command]\n');
        console.log('Commands:');
        console.log('  --install, -i      Install and start the service');
        console.log('  --uninstall, -u    Stop and uninstall the service');
        console.log('  --help, -h         Show this help message\n');
        console.log('Note: Run as Administrator on Windows\n');
        break;
}