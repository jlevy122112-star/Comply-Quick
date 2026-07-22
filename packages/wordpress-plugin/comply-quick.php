<?php
/**
 * Plugin Name: Comply-Quick
 * Description: Injects the Comply-Quick compliance pixel into the site footer.
 * Version: 1.0.0
 * Author: Comply-Quick
 * License: MIT
 */

if (!defined('ABSPATH')) {
  exit;
}

define('COMPLY_QUICK_OPTION_KEY', 'comply_quick_api_key');

define('COMPLY_QUICK_APP_HOST', get_option('comply_quick_app_host', 'https://app.comply-quick.com'));

add_action('wp_footer', 'comply_quick_render_pixel');

function comply_quick_render_pixel(): void {
  $key = get_option(COMPLY_QUICK_OPTION_KEY);
  if (empty($key)) {
    return;
  }
  $src = esc_url(COMPLY_QUICK_APP_HOST . '/api/compliance-agent.js');
  $key_attr = esc_attr($key);
  echo "<script src=\"{$src}\" data-key=\"{$key_attr}\"></script>\n";
}

add_action('admin_menu', 'comply_quick_admin_menu');

function comply_quick_admin_menu(): void {
  add_options_page(
    'Comply-Quick',
    'Comply-Quick',
    'manage_options',
    'comply-quick',
    'comply_quick_settings_page'
  );
}

function comply_quick_settings_page(): void {
  if (isset($_POST['comply_quick_api_key']) && check_admin_referer('comply_quick_settings')) {
    update_option(COMPLY_QUICK_OPTION_KEY, sanitize_text_field(wp_unslash($_POST['comply_quick_api_key'])));
    update_option('comply_quick_app_host', esc_url_raw(wp_unslash($_POST['comply_quick_app_host'] ?? '')));
    echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
  }
  $key = get_option(COMPLY_QUICK_OPTION_KEY, '');
  $host = get_option('comply_quick_app_host', 'https://app.comply-quick.com');
  ?>
  <div class="wrap">
    <h1>Comply-Quick</h1>
    <form method="post">
      <?php wp_nonce_field('comply_quick_settings'); ?>
      <table class="form-table">
        <tr>
          <th scope="row"><label for="comply_quick_api_key">API Key</label></th>
          <td>
            <input type="text" id="comply_quick_api_key" name="comply_quick_api_key" value="<?php echo esc_attr($key); ?>" class="regular-text" />
            <p class="description">Paste the agency API key from the Comply-Quick dashboard.</p>
          </td>
        </tr>
        <tr>
          <th scope="row"><label for="comply_quick_app_host">App Host</label></th>
          <td>
            <input type="url" id="comply_quick_app_host" name="comply_quick_app_host" value="<?php echo esc_attr($host); ?>" class="regular-text" />
            <p class="description">Your Comply-Quick deployment host (e.g. https://app.comply-quick.com).</p>
          </td>
        </tr>
      </table>
      <?php submit_button('Save Changes'); ?>
    </form>
  </div>
  <?php
}
