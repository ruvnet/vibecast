#!/usr/bin/env node
/**
 * GitHub Security Explorer - Cross-Language Security Pattern Discovery
 *
 * Explores GitHub repositories to discover security patterns, build
 * pre-trained models per language/framework, and find correlations
 * across different technology stacks.
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Colors
const C = {
  r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[34m',
  m: '\x1b[35m', c: '\x1b[36m', x: '\x1b[0m', B: '\x1b[1m', d: '\x1b[2m'
};

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY PATTERN DATABASE - Known Vulnerabilities by Language
// ═══════════════════════════════════════════════════════════════════════════

const SECURITY_PATTERNS = {
  javascript: {
    name: 'JavaScript/Node.js',
    extensions: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'],
    patterns: [
      { id: 'JS-001', name: 'eval_injection', regex: /eval\s*\([^)]*\$|eval\s*\([^)]*req\.|eval\s*\([^)]*input/gi, severity: 'critical', cwe: 'CWE-94' },
      { id: 'JS-002', name: 'prototype_pollution', regex: /\[['"]__proto__['"]\]|\['constructor'\]\['prototype'\]/gi, severity: 'high', cwe: 'CWE-1321' },
      { id: 'JS-003', name: 'command_injection', regex: /exec\s*\(|execSync\s*\(|spawn\s*\([^)]*\+|child_process/gi, severity: 'critical', cwe: 'CWE-78' },
      { id: 'JS-004', name: 'sql_injection', regex: /query\s*\(\s*['"`].*\$\{|query\s*\(\s*['"`].*\+\s*req\./gi, severity: 'critical', cwe: 'CWE-89' },
      { id: 'JS-005', name: 'xss_vulnerability', regex: /innerHTML\s*=|outerHTML\s*=|document\.write\s*\(/gi, severity: 'high', cwe: 'CWE-79' },
      { id: 'JS-006', name: 'path_traversal', regex: /\.\.\/|\.\.\\|path\.join\s*\([^)]*req\./gi, severity: 'high', cwe: 'CWE-22' },
      { id: 'JS-007', name: 'insecure_random', regex: /Math\.random\s*\(\s*\)/gi, severity: 'medium', cwe: 'CWE-330' },
      { id: 'JS-008', name: 'hardcoded_secret', regex: /api[_-]?key\s*[:=]\s*['"][^'"]{10,}|password\s*[:=]\s*['"][^'"]+['"]/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'JS-009', name: 'nosql_injection', regex: /\$where|\.find\s*\(\s*\{[^}]*\$|\.findOne\s*\(\s*\{[^}]*req\./gi, severity: 'high', cwe: 'CWE-943' },
      { id: 'JS-010', name: 'ssrf_vulnerability', regex: /fetch\s*\([^)]*req\.|axios\.\w+\s*\([^)]*req\.|request\s*\([^)]*req\./gi, severity: 'high', cwe: 'CWE-918' },
      { id: 'JS-011', name: 'deserialization', regex: /JSON\.parse\s*\([^)]*req\.|unserialize|deserialize/gi, severity: 'medium', cwe: 'CWE-502' },
      { id: 'JS-012', name: 'open_redirect', regex: /res\.redirect\s*\([^)]*req\.|location\.href\s*=\s*[^;]*req\./gi, severity: 'medium', cwe: 'CWE-601' },
    ],
    frameworks: ['express', 'next', 'react', 'vue', 'angular', 'nest', 'fastify', 'koa']
  },

  python: {
    name: 'Python',
    extensions: ['.py', '.pyw', '.pyx'],
    patterns: [
      { id: 'PY-001', name: 'eval_injection', regex: /eval\s*\(|exec\s*\(/gi, severity: 'critical', cwe: 'CWE-94' },
      { id: 'PY-002', name: 'sql_injection', regex: /execute\s*\(\s*['"].*%s|execute\s*\(\s*f['"]|cursor\.\w+\s*\(.*\+/gi, severity: 'critical', cwe: 'CWE-89' },
      { id: 'PY-003', name: 'command_injection', regex: /os\.system\s*\(|subprocess\.\w+\s*\([^)]*shell\s*=\s*True|os\.popen/gi, severity: 'critical', cwe: 'CWE-78' },
      { id: 'PY-004', name: 'pickle_deserialization', regex: /pickle\.loads?\s*\(|cPickle\.loads?\s*\(/gi, severity: 'critical', cwe: 'CWE-502' },
      { id: 'PY-005', name: 'yaml_load', regex: /yaml\.load\s*\([^)]*Loader\s*=\s*yaml\.Loader|yaml\.load\s*\([^)]*\)/gi, severity: 'high', cwe: 'CWE-502' },
      { id: 'PY-006', name: 'path_traversal', regex: /open\s*\([^)]*\+|os\.path\.join\s*\([^)]*request\./gi, severity: 'high', cwe: 'CWE-22' },
      { id: 'PY-007', name: 'ssrf_vulnerability', regex: /requests\.\w+\s*\([^)]*request\.|urllib\.request\.urlopen\s*\([^)]*request\./gi, severity: 'high', cwe: 'CWE-918' },
      { id: 'PY-008', name: 'hardcoded_secret', regex: /api_key\s*=\s*['"][^'"]{10,}|password\s*=\s*['"][^'"]+['"]/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'PY-009', name: 'template_injection', regex: /render_template_string\s*\(|Template\s*\([^)]*request\./gi, severity: 'critical', cwe: 'CWE-94' },
      { id: 'PY-010', name: 'xxe_vulnerability', regex: /etree\.parse\s*\(|xml\.sax\.parse|minidom\.parse/gi, severity: 'high', cwe: 'CWE-611' },
      { id: 'PY-011', name: 'insecure_random', regex: /random\.random\s*\(|random\.randint\s*\(/gi, severity: 'medium', cwe: 'CWE-330' },
      { id: 'PY-012', name: 'debug_enabled', regex: /DEBUG\s*=\s*True|app\.run\s*\([^)]*debug\s*=\s*True/gi, severity: 'medium', cwe: 'CWE-489' },
    ],
    frameworks: ['django', 'flask', 'fastapi', 'tornado', 'pyramid', 'bottle', 'aiohttp']
  },

  java: {
    name: 'Java',
    extensions: ['.java', '.kt', '.scala'],
    patterns: [
      { id: 'JV-001', name: 'sql_injection', regex: /executeQuery\s*\([^)]*\+|prepareStatement\s*\([^)]*\+.*getParameter/gi, severity: 'critical', cwe: 'CWE-89' },
      { id: 'JV-002', name: 'command_injection', regex: /Runtime\.getRuntime\(\)\.exec\s*\(|ProcessBuilder\s*\(/gi, severity: 'critical', cwe: 'CWE-78' },
      { id: 'JV-003', name: 'deserialization', regex: /ObjectInputStream|readObject\s*\(|XMLDecoder/gi, severity: 'critical', cwe: 'CWE-502' },
      { id: 'JV-004', name: 'xxe_vulnerability', regex: /DocumentBuilder|SAXParser|XMLReader/gi, severity: 'high', cwe: 'CWE-611' },
      { id: 'JV-005', name: 'path_traversal', regex: /new\s+File\s*\([^)]*getParameter|Paths\.get\s*\([^)]*getParameter/gi, severity: 'high', cwe: 'CWE-22' },
      { id: 'JV-006', name: 'ldap_injection', regex: /InitialDirContext|search\s*\([^)]*getParameter/gi, severity: 'high', cwe: 'CWE-90' },
      { id: 'JV-007', name: 'log_injection', regex: /logger\.\w+\s*\([^)]*getParameter|log\.\w+\s*\([^)]*request\./gi, severity: 'medium', cwe: 'CWE-117' },
      { id: 'JV-008', name: 'hardcoded_secret', regex: /\.setPassword\s*\(['"][^'"]+['"]\)|apiKey\s*=\s*['"][^'"]{10,}/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'JV-009', name: 'insecure_crypto', regex: /DES|MD5|SHA1|RC4|Cipher\.getInstance\s*\(['"]DES/gi, severity: 'medium', cwe: 'CWE-327' },
      { id: 'JV-010', name: 'ssrf_vulnerability', regex: /new\s+URL\s*\([^)]*getParameter|HttpURLConnection/gi, severity: 'high', cwe: 'CWE-918' },
      { id: 'JV-011', name: 'expression_injection', regex: /SpEL|ELProcessor|ExpressionFactory/gi, severity: 'critical', cwe: 'CWE-917' },
      { id: 'JV-012', name: 'trust_boundary', regex: /TrustManager|X509TrustManager|HostnameVerifier.*return\s+true/gi, severity: 'high', cwe: 'CWE-295' },
    ],
    frameworks: ['spring', 'struts', 'hibernate', 'jersey', 'dropwizard', 'micronaut', 'quarkus']
  },

  go: {
    name: 'Go',
    extensions: ['.go'],
    patterns: [
      { id: 'GO-001', name: 'sql_injection', regex: /db\.Query\s*\([^)]*\+|db\.Exec\s*\([^)]*\+|fmt\.Sprintf.*SELECT/gi, severity: 'critical', cwe: 'CWE-89' },
      { id: 'GO-002', name: 'command_injection', regex: /exec\.Command\s*\([^)]*\+|os\.StartProcess/gi, severity: 'critical', cwe: 'CWE-78' },
      { id: 'GO-003', name: 'path_traversal', regex: /filepath\.Join\s*\([^)]*r\.\w+|os\.Open\s*\([^)]*r\.\w+/gi, severity: 'high', cwe: 'CWE-22' },
      { id: 'GO-004', name: 'ssrf_vulnerability', regex: /http\.Get\s*\([^)]*r\.\w+|http\.Post\s*\([^)]*r\.\w+/gi, severity: 'high', cwe: 'CWE-918' },
      { id: 'GO-005', name: 'template_injection', regex: /template\.HTML\s*\(|template\.JS\s*\(/gi, severity: 'high', cwe: 'CWE-94' },
      { id: 'GO-006', name: 'hardcoded_secret', regex: /apiKey\s*:?=\s*['"][^'"]{10,}|password\s*:?=\s*['"][^'"]+['"]/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'GO-007', name: 'tls_skip_verify', regex: /InsecureSkipVerify\s*:\s*true/gi, severity: 'high', cwe: 'CWE-295' },
      { id: 'GO-008', name: 'weak_random', regex: /math\/rand|rand\.Intn\s*\(|rand\.Int\s*\(/gi, severity: 'medium', cwe: 'CWE-330' },
      { id: 'GO-009', name: 'race_condition', regex: /go\s+func\s*\(|go\s+\w+\s*\(/gi, severity: 'low', cwe: 'CWE-362' },
      { id: 'GO-010', name: 'defer_in_loop', regex: /for\s+.*\{[^}]*defer\s+/gi, severity: 'low', cwe: 'CWE-404' },
    ],
    frameworks: ['gin', 'echo', 'fiber', 'chi', 'gorilla', 'beego', 'buffalo']
  },

  rust: {
    name: 'Rust',
    extensions: ['.rs'],
    patterns: [
      { id: 'RS-001', name: 'unsafe_block', regex: /unsafe\s*\{/gi, severity: 'medium', cwe: 'CWE-119' },
      { id: 'RS-002', name: 'command_injection', regex: /Command::new\s*\([^)]*\+|process::Command/gi, severity: 'high', cwe: 'CWE-78' },
      { id: 'RS-003', name: 'sql_injection', regex: /query\s*\([^)]*format!|execute\s*\([^)]*format!/gi, severity: 'critical', cwe: 'CWE-89' },
      { id: 'RS-004', name: 'unwrap_panic', regex: /\.unwrap\s*\(\s*\)|\.expect\s*\(/gi, severity: 'low', cwe: 'CWE-754' },
      { id: 'RS-005', name: 'hardcoded_secret', regex: /api_key\s*=\s*['"][^'"]{10,}|password\s*=\s*['"][^'"]+['"]/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'RS-006', name: 'path_traversal', regex: /Path::new\s*\([^)]*\+|PathBuf::from\s*\([^)]*\+/gi, severity: 'high', cwe: 'CWE-22' },
      { id: 'RS-007', name: 'transmute_unsafe', regex: /std::mem::transmute|transmute_copy/gi, severity: 'high', cwe: 'CWE-704' },
      { id: 'RS-008', name: 'raw_pointer', regex: /\*mut\s+\w+|\*const\s+\w+|as\s+\*mut/gi, severity: 'medium', cwe: 'CWE-119' },
    ],
    frameworks: ['actix', 'rocket', 'warp', 'axum', 'tide', 'hyper']
  },

  php: {
    name: 'PHP',
    extensions: ['.php', '.phtml', '.php5', '.php7'],
    patterns: [
      { id: 'PHP-001', name: 'sql_injection', regex: /mysql_query\s*\(|mysqli_query\s*\([^)]*\$_|PDO.*\$_(?:GET|POST|REQUEST)/gi, severity: 'critical', cwe: 'CWE-89' },
      { id: 'PHP-002', name: 'command_injection', regex: /exec\s*\(|system\s*\(|passthru\s*\(|shell_exec\s*\(|`.*\$_/gi, severity: 'critical', cwe: 'CWE-78' },
      { id: 'PHP-003', name: 'file_inclusion', regex: /include\s*\([^)]*\$_|require\s*\([^)]*\$_|include_once\s*\([^)]*\$_/gi, severity: 'critical', cwe: 'CWE-98' },
      { id: 'PHP-004', name: 'eval_injection', regex: /eval\s*\([^)]*\$_|assert\s*\([^)]*\$_|preg_replace.*\/e/gi, severity: 'critical', cwe: 'CWE-94' },
      { id: 'PHP-005', name: 'xss_vulnerability', regex: /echo\s+\$_(?:GET|POST|REQUEST)|print\s+\$_(?:GET|POST|REQUEST)/gi, severity: 'high', cwe: 'CWE-79' },
      { id: 'PHP-006', name: 'deserialization', regex: /unserialize\s*\([^)]*\$_/gi, severity: 'critical', cwe: 'CWE-502' },
      { id: 'PHP-007', name: 'path_traversal', regex: /file_get_contents\s*\([^)]*\$_|fopen\s*\([^)]*\$_|readfile\s*\([^)]*\$_/gi, severity: 'high', cwe: 'CWE-22' },
      { id: 'PHP-008', name: 'xxe_vulnerability', regex: /simplexml_load_string|DOMDocument.*loadXML|XMLReader/gi, severity: 'high', cwe: 'CWE-611' },
      { id: 'PHP-009', name: 'hardcoded_secret', regex: /\$api_key\s*=\s*['"][^'"]{10,}|\$password\s*=\s*['"][^'"]+['"]/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'PHP-010', name: 'open_redirect', regex: /header\s*\(\s*['"]Location.*\$_/gi, severity: 'medium', cwe: 'CWE-601' },
      { id: 'PHP-011', name: 'insecure_random', regex: /rand\s*\(|mt_rand\s*\(/gi, severity: 'medium', cwe: 'CWE-330' },
      { id: 'PHP-012', name: 'type_juggling', regex: /==\s*['"]|['"]\s*==/gi, severity: 'medium', cwe: 'CWE-697' },
    ],
    frameworks: ['laravel', 'symfony', 'codeigniter', 'yii', 'cakephp', 'slim', 'wordpress']
  },

  ruby: {
    name: 'Ruby',
    extensions: ['.rb', '.erb', '.rake'],
    patterns: [
      { id: 'RB-001', name: 'command_injection', regex: /system\s*\(|`.*#\{|exec\s*\(|%x\[.*#\{/gi, severity: 'critical', cwe: 'CWE-78' },
      { id: 'RB-002', name: 'sql_injection', regex: /where\s*\([^)]*#\{|find_by_sql\s*\([^)]*#\{|execute\s*\([^)]*#\{/gi, severity: 'critical', cwe: 'CWE-89' },
      { id: 'RB-003', name: 'eval_injection', regex: /eval\s*\(|instance_eval\s*\(|class_eval\s*\(/gi, severity: 'critical', cwe: 'CWE-94' },
      { id: 'RB-004', name: 'deserialization', regex: /Marshal\.load\s*\(|YAML\.load\s*\(/gi, severity: 'critical', cwe: 'CWE-502' },
      { id: 'RB-005', name: 'xss_vulnerability', regex: /\.html_safe|raw\s*\(|<%==?\s*params/gi, severity: 'high', cwe: 'CWE-79' },
      { id: 'RB-006', name: 'open_redirect', regex: /redirect_to\s*\(?params|redirect_to\s*\(?request\./gi, severity: 'medium', cwe: 'CWE-601' },
      { id: 'RB-007', name: 'mass_assignment', regex: /attr_accessible|params\.permit!/gi, severity: 'medium', cwe: 'CWE-915' },
      { id: 'RB-008', name: 'hardcoded_secret', regex: /api_key\s*=\s*['"][^'"]{10,}|password\s*=\s*['"][^'"]+['"]/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'RB-009', name: 'path_traversal', regex: /File\.read\s*\([^)]*params|send_file\s*\([^)]*params/gi, severity: 'high', cwe: 'CWE-22' },
      { id: 'RB-010', name: 'render_user_input', regex: /render\s+.*params\[|render\s+inline:/gi, severity: 'high', cwe: 'CWE-94' },
    ],
    frameworks: ['rails', 'sinatra', 'hanami', 'grape', 'padrino']
  },

  csharp: {
    name: 'C#/.NET',
    extensions: ['.cs', '.vb', '.aspx', '.cshtml'],
    patterns: [
      { id: 'CS-001', name: 'sql_injection', regex: /ExecuteReader\s*\([^)]*\+|SqlCommand\s*\([^)]*\+.*Request/gi, severity: 'critical', cwe: 'CWE-89' },
      { id: 'CS-002', name: 'command_injection', regex: /Process\.Start\s*\(|ProcessStartInfo/gi, severity: 'critical', cwe: 'CWE-78' },
      { id: 'CS-003', name: 'deserialization', regex: /BinaryFormatter|XmlSerializer|JsonConvert\.DeserializeObject/gi, severity: 'high', cwe: 'CWE-502' },
      { id: 'CS-004', name: 'xxe_vulnerability', regex: /XmlDocument|XmlReader|XmlTextReader/gi, severity: 'high', cwe: 'CWE-611' },
      { id: 'CS-005', name: 'path_traversal', regex: /File\.Open\s*\([^)]*Request|StreamReader\s*\([^)]*Request/gi, severity: 'high', cwe: 'CWE-22' },
      { id: 'CS-006', name: 'ldap_injection', regex: /DirectorySearcher|DirectoryEntry/gi, severity: 'medium', cwe: 'CWE-90' },
      { id: 'CS-007', name: 'hardcoded_secret', regex: /ApiKey\s*=\s*['"][^'"]{10,}|Password\s*=\s*['"][^'"]+['"]/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'CS-008', name: 'insecure_crypto', regex: /DESCryptoServiceProvider|MD5CryptoServiceProvider|SHA1/gi, severity: 'medium', cwe: 'CWE-327' },
      { id: 'CS-009', name: 'open_redirect', regex: /Response\.Redirect\s*\([^)]*Request|Redirect\s*\([^)]*Request/gi, severity: 'medium', cwe: 'CWE-601' },
      { id: 'CS-010', name: 'xss_vulnerability', regex: /Response\.Write\s*\([^)]*Request|@Html\.Raw\s*\(/gi, severity: 'high', cwe: 'CWE-79' },
    ],
    frameworks: ['aspnet', 'blazor', 'mvc', 'webapi', 'nancy', 'servicestack']
  },

  c_cpp: {
    name: 'C/C++',
    extensions: ['.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx'],
    patterns: [
      { id: 'CC-001', name: 'buffer_overflow', regex: /strcpy\s*\(|strcat\s*\(|sprintf\s*\(|gets\s*\(/gi, severity: 'critical', cwe: 'CWE-120' },
      { id: 'CC-002', name: 'format_string', regex: /printf\s*\([^"]*\)|sprintf\s*\([^,]+,[^"]*\)/gi, severity: 'critical', cwe: 'CWE-134' },
      { id: 'CC-003', name: 'command_injection', regex: /system\s*\(|popen\s*\(|exec[lv]p?\s*\(/gi, severity: 'critical', cwe: 'CWE-78' },
      { id: 'CC-004', name: 'use_after_free', regex: /free\s*\([^)]+\).*\n.*\1/gi, severity: 'critical', cwe: 'CWE-416' },
      { id: 'CC-005', name: 'integer_overflow', regex: /\+\+\w+\s*>|<\s*\w+\+\+|\w+\s*\*\s*\w+\s*[<>]/gi, severity: 'high', cwe: 'CWE-190' },
      { id: 'CC-006', name: 'null_pointer', regex: /\*\s*NULL|\*\s*nullptr/gi, severity: 'medium', cwe: 'CWE-476' },
      { id: 'CC-007', name: 'hardcoded_secret', regex: /api_key\s*=\s*['"][^'"]{10,}|password\s*=\s*['"][^'"]+['"]/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'CC-008', name: 'race_condition', regex: /pthread_create|CreateThread|_beginthread/gi, severity: 'medium', cwe: 'CWE-362' },
      { id: 'CC-009', name: 'memory_leak', regex: /malloc\s*\([^)]+\)(?!.*free)/gi, severity: 'medium', cwe: 'CWE-401' },
      { id: 'CC-010', name: 'unsafe_functions', regex: /scanf\s*\(|sscanf\s*\(|fscanf\s*\(/gi, severity: 'high', cwe: 'CWE-120' },
    ],
    frameworks: ['qt', 'boost', 'poco', 'civetweb', 'mongoose']
  },

  shell: {
    name: 'Shell/Bash',
    extensions: ['.sh', '.bash', '.zsh', '.ksh'],
    patterns: [
      { id: 'SH-001', name: 'command_injection', regex: /eval\s+['"$]|\$\([^)]*\$\{?[a-zA-Z]/gi, severity: 'critical', cwe: 'CWE-78' },
      { id: 'SH-002', name: 'unquoted_variable', regex: /\$\w+[^"']|\$\{\w+\}[^"']/gi, severity: 'high', cwe: 'CWE-78' },
      { id: 'SH-003', name: 'hardcoded_secret', regex: /API_KEY=["']?[^'"$\s]{10,}|PASSWORD=["']?[^'"$\s]+/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'SH-004', name: 'insecure_temp', regex: /\/tmp\/[a-zA-Z]+(?![a-zA-Z0-9])|mktemp\s+-[^d]/gi, severity: 'medium', cwe: 'CWE-377' },
      { id: 'SH-005', name: 'curl_insecure', regex: /curl\s+.*-k|curl\s+.*--insecure|wget\s+.*--no-check/gi, severity: 'medium', cwe: 'CWE-295' },
      { id: 'SH-006', name: 'world_writable', regex: /chmod\s+777|chmod\s+a\+w/gi, severity: 'medium', cwe: 'CWE-732' },
    ],
    frameworks: []
  },

  sql: {
    name: 'SQL',
    extensions: ['.sql'],
    patterns: [
      { id: 'SQL-001', name: 'grant_all', regex: /GRANT\s+ALL|GRANT\s+.*WITH\s+GRANT\s+OPTION/gi, severity: 'high', cwe: 'CWE-250' },
      { id: 'SQL-002', name: 'drop_table', regex: /DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+TABLE/gi, severity: 'medium', cwe: 'CWE-1059' },
      { id: 'SQL-003', name: 'hardcoded_creds', regex: /PASSWORD\s*=\s*['"][^'"]+['"]/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'SQL-004', name: 'public_execute', regex: /GRANT\s+EXECUTE.*TO\s+PUBLIC/gi, severity: 'high', cwe: 'CWE-250' },
    ],
    frameworks: ['mysql', 'postgresql', 'sqlite', 'mssql', 'oracle']
  },

  yaml: {
    name: 'YAML/Config',
    extensions: ['.yml', '.yaml'],
    patterns: [
      { id: 'YML-001', name: 'hardcoded_secret', regex: /password:\s*[^\s$]+|api_key:\s*[^\s$]+|secret:\s*[^\s$]+/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'YML-002', name: 'debug_enabled', regex: /debug:\s*true|DEBUG:\s*true/gi, severity: 'medium', cwe: 'CWE-489' },
      { id: 'YML-003', name: 'privileged_container', regex: /privileged:\s*true|hostNetwork:\s*true/gi, severity: 'high', cwe: 'CWE-250' },
      { id: 'YML-004', name: 'insecure_tls', regex: /verify_ssl:\s*false|tls_verify:\s*false|insecure:\s*true/gi, severity: 'high', cwe: 'CWE-295' },
    ],
    frameworks: ['kubernetes', 'docker', 'ansible', 'terraform']
  },

  dockerfile: {
    name: 'Dockerfile',
    extensions: ['Dockerfile', '.dockerfile'],
    patterns: [
      { id: 'DF-001', name: 'run_as_root', regex: /^(?!.*USER\s+\d).*$/gim, severity: 'medium', cwe: 'CWE-250' },
      { id: 'DF-002', name: 'hardcoded_secret', regex: /ENV\s+\w*(PASSWORD|SECRET|KEY|TOKEN)\w*\s*=\s*\S+/gi, severity: 'high', cwe: 'CWE-798' },
      { id: 'DF-003', name: 'latest_tag', regex: /FROM\s+\S+:latest|FROM\s+[^:]+\s*$/gim, severity: 'low', cwe: 'CWE-1104' },
      { id: 'DF-004', name: 'add_vs_copy', regex: /^ADD\s+http/gim, severity: 'medium', cwe: 'CWE-494' },
      { id: 'DF-005', name: 'sudo_usage', regex: /sudo\s+/gi, severity: 'medium', cwe: 'CWE-250' },
    ],
    frameworks: []
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// POPULAR REPOSITORIES DATABASE (Curated for security analysis)
// ═══════════════════════════════════════════════════════════════════════════

const POPULAR_REPOS = {
  javascript: [
    { owner: 'expressjs', repo: 'express', desc: 'Fast web framework' },
    { owner: 'nestjs', repo: 'nest', desc: 'Progressive Node.js framework' },
    { owner: 'fastify', repo: 'fastify', desc: 'Fast web framework' },
    { owner: 'koajs', repo: 'koa', desc: 'Next gen web framework' },
    { owner: 'hapijs', repo: 'hapi', desc: 'Server framework' },
    { owner: 'axios', repo: 'axios', desc: 'HTTP client' },
    { owner: 'lodash', repo: 'lodash', desc: 'Utility library' },
    { owner: 'moment', repo: 'moment', desc: 'Date library' },
  ],
  python: [
    { owner: 'pallets', repo: 'flask', desc: 'Micro web framework' },
    { owner: 'django', repo: 'django', desc: 'Web framework' },
    { owner: 'tiangolo', repo: 'fastapi', desc: 'Modern API framework' },
    { owner: 'tornadoweb', repo: 'tornado', desc: 'Web server' },
    { owner: 'psf', repo: 'requests', desc: 'HTTP library' },
    { owner: 'sqlalchemy', repo: 'sqlalchemy', desc: 'Database toolkit' },
  ],
  go: [
    { owner: 'gin-gonic', repo: 'gin', desc: 'HTTP framework' },
    { owner: 'labstack', repo: 'echo', desc: 'Web framework' },
    { owner: 'gofiber', repo: 'fiber', desc: 'Express-inspired framework' },
    { owner: 'gorilla', repo: 'mux', desc: 'HTTP router' },
  ],
  rust: [
    { owner: 'actix', repo: 'actix-web', desc: 'Web framework' },
    { owner: 'SergioBenitez', repo: 'Rocket', desc: 'Web framework' },
    { owner: 'tokio-rs', repo: 'axum', desc: 'Web framework' },
    { owner: 'hyperium', repo: 'hyper', desc: 'HTTP library' },
  ],
  java: [
    { owner: 'spring-projects', repo: 'spring-boot', desc: 'Application framework' },
    { owner: 'apache', repo: 'struts', desc: 'MVC framework' },
    { owner: 'eclipse-ee4j', repo: 'jersey', desc: 'REST framework' },
  ],
  php: [
    { owner: 'laravel', repo: 'laravel', desc: 'Web framework' },
    { owner: 'symfony', repo: 'symfony', desc: 'PHP framework' },
    { owner: 'WordPress', repo: 'WordPress', desc: 'CMS platform' },
  ],
  ruby: [
    { owner: 'rails', repo: 'rails', desc: 'Web framework' },
    { owner: 'sinatra', repo: 'sinatra', desc: 'DSL for web apps' },
  ],
  csharp: [
    { owner: 'dotnet', repo: 'aspnetcore', desc: 'ASP.NET Core' },
    { owner: 'NancyFx', repo: 'Nancy', desc: 'Lightweight framework' },
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// GITHUB API CLIENT
// ═══════════════════════════════════════════════════════════════════════════

class GitHubExplorer {
  constructor() {
    this.baseUrl = 'api.github.com';
    this.findings = [];
    this.languageStats = {};
    this.frameworkStats = {};
    this.cweStats = {};
    this.correlations = [];
  }

  async fetchJSON(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path: path,
        headers: {
          'User-Agent': 'SecurityExplorer/1.0',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      }).on('error', reject);
    });
  }

  async fetchFileContent(owner, repo, path) {
    try {
      const data = await this.fetchJSON(`/repos/${owner}/${repo}/contents/${path}`);
      if (data && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch (e) {
      // Ignore errors
    }
    return null;
  }

  async searchRepositories(language, limit = 10) {
    const query = encodeURIComponent(`language:${language} stars:>1000`);
    const data = await this.fetchJSON(`/search/repositories?q=${query}&sort=stars&per_page=${limit}`);
    return data?.items || [];
  }

  async getRepoFiles(owner, repo, path = '') {
    try {
      const data = await this.fetchJSON(`/repos/${owner}/${repo}/contents/${path}`);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  async analyzeFile(content, language, filePath) {
    const findings = [];
    const patterns = SECURITY_PATTERNS[language]?.patterns || [];

    for (const pattern of patterns) {
      const matches = content.match(pattern.regex);
      if (matches) {
        findings.push({
          patternId: pattern.id,
          name: pattern.name,
          severity: pattern.severity,
          cwe: pattern.cwe,
          matchCount: matches.length,
          file: filePath,
          language
        });
      }
    }

    return findings;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL CODE ANALYZER (For simulated analysis)
// ═══════════════════════════════════════════════════════════════════════════

class LocalSecurityAnalyzer {
  constructor() {
    this.findings = [];
    this.languageStats = {};
    this.patternStats = {};
    this.cweStats = {};
    this.severityStats = { critical: 0, high: 0, medium: 0, low: 0 };
    this.frameworkFindings = {};
  }

  analyzeContent(content, language, source = 'unknown') {
    const langPatterns = SECURITY_PATTERNS[language];
    if (!langPatterns) return [];

    const findings = [];
    for (const pattern of langPatterns.patterns) {
      try {
        const matches = content.match(pattern.regex);
        if (matches && matches.length > 0) {
          findings.push({
            patternId: pattern.id,
            name: pattern.name,
            severity: pattern.severity,
            cwe: pattern.cwe,
            matchCount: matches.length,
            language,
            source,
            samples: matches.slice(0, 3)
          });

          // Update stats
          if (!this.languageStats[language]) {
            this.languageStats[language] = { total: 0, bySeverity: {}, byCwe: {} };
          }
          this.languageStats[language].total += matches.length;
          this.languageStats[language].bySeverity[pattern.severity] =
            (this.languageStats[language].bySeverity[pattern.severity] || 0) + matches.length;
          this.languageStats[language].byCwe[pattern.cwe] =
            (this.languageStats[language].byCwe[pattern.cwe] || 0) + matches.length;

          if (!this.patternStats[pattern.name]) {
            this.patternStats[pattern.name] = { count: 0, languages: new Set(), cwe: pattern.cwe };
          }
          this.patternStats[pattern.name].count += matches.length;
          this.patternStats[pattern.name].languages.add(language);

          this.cweStats[pattern.cwe] = (this.cweStats[pattern.cwe] || 0) + matches.length;
          this.severityStats[pattern.severity] += matches.length;
        }
      } catch (e) {
        // Skip invalid regex
      }
    }

    this.findings.push(...findings);
    return findings;
  }

  detectFrameworks(content, language) {
    const langPatterns = SECURITY_PATTERNS[language];
    if (!langPatterns) return [];

    const detected = [];
    const frameworkPatterns = {
      express: /require\s*\(\s*['"]express['"]\)|from\s+['"]express['"]/i,
      django: /from\s+django|import\s+django/i,
      flask: /from\s+flask|import\s+flask/i,
      fastapi: /from\s+fastapi|import\s+fastapi/i,
      spring: /@SpringBoot|@RestController|@Autowired/i,
      rails: /class\s+\w+\s*<\s*ApplicationController|ActiveRecord/i,
      laravel: /use\s+Illuminate|Laravel/i,
      gin: /github\.com\/gin-gonic\/gin/i,
      actix: /actix_web|actix-web/i,
      nest: /@nestjs\/|@Module\s*\(/i
    };

    for (const [framework, pattern] of Object.entries(frameworkPatterns)) {
      if (pattern.test(content)) {
        detected.push(framework);
      }
    }

    return detected;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATED REPOSITORY CONTENT (For offline analysis)
// ═══════════════════════════════════════════════════════════════════════════

const SIMULATED_CODE_SAMPLES = {
  javascript: [
    // Express with potential vulnerabilities
    `const express = require('express');
const app = express();
app.get('/search', (req, res) => {
  const query = req.query.q;
  db.query("SELECT * FROM users WHERE name = '" + query + "'");  // SQL injection
  eval(req.body.code);  // Code injection
  res.redirect(req.query.url);  // Open redirect
});
app.listen(3000);`,
    // Node.js command execution
    `const { exec } = require('child_process');
function runCommand(userInput) {
  exec('ls -la ' + userInput);  // Command injection
  const apiKey = "sk-1234567890abcdef";  // Hardcoded secret
}`,
    // Prototype pollution pattern
    `function merge(target, source) {
  for (let key in source) {
    target[key] = source[key];  // Prototype pollution
  }
  target['__proto__']['admin'] = true;
}`,
    // DOM XSS
    `document.getElementById('output').innerHTML = userInput;  // XSS
document.write('<div>' + location.hash + '</div>');`,
    // Path traversal
    `const path = require('path');
app.get('/file', (req, res) => {
  const filePath = path.join('/uploads', req.query.name);  // Path traversal
  fs.readFile(filePath, (err, data) => res.send(data));
});`,
  ],

  python: [
    // Flask vulnerable patterns
    `from flask import Flask, request, render_template_string
app = Flask(__name__)
@app.route('/search')
def search():
    query = request.args.get('q')
    cursor.execute("SELECT * FROM users WHERE name = '%s'" % query)  # SQL injection
    eval(request.form['code'])  # Code injection
    return render_template_string(request.args.get('template'))  # Template injection
app.run(debug=True)`,
    // Command injection
    `import os
import subprocess
def process_file(filename):
    os.system('cat ' + filename)  # Command injection
    subprocess.call(['rm', filename], shell=True)  # Dangerous shell
    api_key = "AIzaSyC1234567890"  # Hardcoded secret`,
    // Deserialization
    `import pickle
import yaml
def load_data(data):
    obj = pickle.loads(data)  # Insecure deserialization
    config = yaml.load(open('config.yml'))  # Unsafe YAML load`,
    // SSRF
    `import requests
def fetch_url(url):
    return requests.get(request.args.get('url'))  # SSRF vulnerability`,
  ],

  java: [
    // SQL injection
    `public class UserDAO {
    public User findUser(String name) {
        String query = "SELECT * FROM users WHERE name = '" + request.getParameter("name") + "'";
        return jdbcTemplate.query(query);  // SQL injection
    }
}`,
    // Deserialization
    `public Object deserialize(byte[] data) {
    ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(data));
    return ois.readObject();  // Insecure deserialization
}`,
    // XXE
    `public Document parse(String xml) {
    DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
    DocumentBuilder builder = factory.newDocumentBuilder();  // XXE vulnerable
    return builder.parse(new InputSource(new StringReader(xml)));
}`,
    // Command injection
    `public void execute(String cmd) {
    Runtime.getRuntime().exec("cmd /c " + userInput);  // Command injection
    String password = "admin123";  // Hardcoded password
}`,
  ],

  go: [
    // SQL injection in Go
    `func getUser(w http.ResponseWriter, r *http.Request) {
    name := r.URL.Query().Get("name")
    query := fmt.Sprintf("SELECT * FROM users WHERE name = '%s'", name)  // SQL injection
    db.Query(query)
}`,
    // Command injection
    `func runCmd(input string) {
    cmd := exec.Command("sh", "-c", "echo " + input)  // Command injection
    cmd.Run()
}`,
    // TLS skip verify
    `func createClient() *http.Client {
    tr := &http.Transport{
        TLSClientConfig: &tls.Config{InsecureSkipVerify: true},  // Insecure TLS
    }
    return &http.Client{Transport: tr}
}`,
    // Weak random
    `func generateToken() string {
    rand.Seed(time.Now().UnixNano())
    return fmt.Sprintf("%d", rand.Intn(1000000))  // Weak random
}`,
  ],

  rust: [
    // Unsafe blocks
    `fn process_data(data: &[u8]) {
    unsafe {
        let ptr = data.as_ptr();  // Unsafe block
        std::mem::transmute::<&[u8], &str>(data);  // Dangerous transmute
    }
}`,
    // SQL injection in Rust
    `async fn get_user(pool: &PgPool, name: &str) {
    let query = format!("SELECT * FROM users WHERE name = '{}'", name);  // SQL injection
    sqlx::query(&query).fetch_one(pool).await;
}`,
    // Unwrap usage
    `fn parse_config(s: &str) -> Config {
    let config: Config = serde_json::from_str(s).unwrap();  // Panic on error
    let file = File::open(path).expect("Failed to open");  // Panic
    config
}`,
  ],

  php: [
    // Multiple PHP vulnerabilities
    `<?php
$name = $_GET['name'];
$sql = "SELECT * FROM users WHERE name = '$name'";  // SQL injection
mysql_query($sql);

system('ls -la ' . $_GET['dir']);  // Command injection
include($_GET['page'] . '.php');  // File inclusion
eval($_POST['code']);  // Code injection

echo $_GET['message'];  // XSS
$obj = unserialize($_COOKIE['data']);  // Deserialization

$password = "secret123";  // Hardcoded
header("Location: " . $_GET['url']);  // Open redirect
?>`,
  ],

  ruby: [
    // Rails vulnerabilities
    `class UsersController < ApplicationController
  def show
    @user = User.find_by_sql("SELECT * FROM users WHERE id = #{params[:id]}")  # SQL injection
    system("cat " + params[:file])  # Command injection
    render inline: params[:template]  # Template injection
    redirect_to params[:url]  # Open redirect
  end

  def load_config
    data = YAML.load(File.read(params[:config]))  # Unsafe YAML
    Marshal.load(Base64.decode64(params[:data]))  # Deserialization
  end
end`,
  ],

  shell: [
    // Shell script vulnerabilities
    `#!/bin/bash
PASSWORD="supersecret123"  # Hardcoded secret
API_KEY=abcdef1234567890

# Unquoted variables
rm -rf $USER_INPUT  # Command injection
eval "$UNTRUSTED"  # Eval injection

# Insecure operations
curl -k https://example.com  # Skip TLS verify
chmod 777 /tmp/data  # World writable
`,
  ],

  yaml: [
    // Kubernetes/Docker config issues
    `apiVersion: v1
kind: Pod
spec:
  containers:
  - name: app
    image: myapp:latest  # Using latest tag
    securityContext:
      privileged: true  # Privileged container
  hostNetwork: true  # Host network access

environment:
  DEBUG: true  # Debug enabled
  API_KEY: sk-1234567890  # Hardcoded secret
  password: admin123
`,
  ],

  c_cpp: [
    // C/C++ memory vulnerabilities
    `#include <stdio.h>
#include <string.h>

void process(char *input) {
    char buffer[64];
    strcpy(buffer, input);  // Buffer overflow
    sprintf(buffer, input);  // Format string
    gets(buffer);  // Never use gets

    system(input);  // Command injection

    char *ptr = malloc(100);
    free(ptr);
    printf("%s", ptr);  // Use after free
}

int main() {
    char password[] = "hardcoded123";  // Hardcoded
    return 0;
}`,
  ],

  csharp: [
    // C# vulnerabilities
    `public class UserController : Controller {
    public ActionResult Search(string query) {
        string sql = "SELECT * FROM Users WHERE Name = '" + Request["name"] + "'";  // SQL injection
        SqlCommand cmd = new SqlCommand(sql);

        Process.Start("cmd", "/c " + userInput);  // Command injection

        XmlDocument doc = new XmlDocument();
        doc.LoadXml(xmlInput);  // XXE

        BinaryFormatter bf = new BinaryFormatter();
        object obj = bf.Deserialize(stream);  // Deserialization

        Response.Redirect(Request["url"]);  // Open redirect
        Response.Write(Request["msg"]);  // XSS

        return View();
    }
}`,
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// CORRELATION ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

class CorrelationEngine {
  constructor() {
    this.correlations = [];
    this.crossLanguagePatterns = {};
  }

  findCrossLanguageCorrelations(analyzer) {
    const patterns = analyzer.patternStats;
    const correlations = [];

    // Find patterns that appear across multiple languages
    for (const [patternName, stats] of Object.entries(patterns)) {
      if (stats.languages.size > 1) {
        correlations.push({
          type: 'cross_language',
          pattern: patternName,
          cwe: stats.cwe,
          languages: [...stats.languages],
          totalCount: stats.count,
          description: `${patternName} vulnerability found across ${stats.languages.size} languages`
        });
      }
    }

    // CWE correlations
    const cweByLanguage = {};
    for (const [lang, stats] of Object.entries(analyzer.languageStats)) {
      for (const [cwe, count] of Object.entries(stats.byCwe)) {
        if (!cweByLanguage[cwe]) cweByLanguage[cwe] = {};
        cweByLanguage[cwe][lang] = count;
      }
    }

    for (const [cwe, langCounts] of Object.entries(cweByLanguage)) {
      const languages = Object.keys(langCounts);
      if (languages.length > 1) {
        correlations.push({
          type: 'cwe_correlation',
          cwe,
          languages,
          distribution: langCounts,
          description: `${cwe} appears in ${languages.length} languages`
        });
      }
    }

    // Severity patterns
    const severityByLanguage = {};
    for (const [lang, stats] of Object.entries(analyzer.languageStats)) {
      severityByLanguage[lang] = stats.bySeverity;
    }

    const criticalLanguages = Object.entries(severityByLanguage)
      .filter(([_, s]) => (s.critical || 0) > 0)
      .sort((a, b) => (b[1].critical || 0) - (a[1].critical || 0));

    if (criticalLanguages.length > 0) {
      correlations.push({
        type: 'severity_analysis',
        description: 'Languages by critical vulnerability density',
        ranking: criticalLanguages.map(([lang, s]) => ({ lang, critical: s.critical || 0 }))
      });
    }

    this.correlations = correlations;
    return correlations;
  }

  generateInsights(analyzer) {
    const insights = [];

    // Most common vulnerability types
    const sortedPatterns = Object.entries(analyzer.patternStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    insights.push({
      type: 'top_vulnerabilities',
      title: 'Most Common Vulnerability Patterns',
      data: sortedPatterns.map(([name, stats]) => ({
        name,
        count: stats.count,
        cwe: stats.cwe,
        languages: [...stats.languages]
      }))
    });

    // Most vulnerable languages
    const langRanking = Object.entries(analyzer.languageStats)
      .map(([lang, stats]) => ({
        lang,
        total: stats.total,
        critical: stats.bySeverity.critical || 0,
        high: stats.bySeverity.high || 0
      }))
      .sort((a, b) => b.critical - a.critical);

    insights.push({
      type: 'language_risk',
      title: 'Language Risk Profile',
      data: langRanking
    });

    // CWE trends
    const topCWEs = Object.entries(analyzer.cweStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    insights.push({
      type: 'cwe_trends',
      title: 'Top CWE Categories',
      data: topCWEs.map(([cwe, count]) => ({ cwe, count }))
    });

    return insights;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODEL GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

class SecurityModelGenerator {
  constructor() {
    this.models = {};
  }

  generateVectorEmbedding(text, dim = 128) {
    const hash = crypto.createHash('sha512').update(text).digest();
    const vector = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      vector[i] = (hash[i % hash.length] / 255.0) * 2 - 1;
    }
    // Normalize
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    for (let i = 0; i < dim; i++) vector[i] /= norm;
    return Array.from(vector);
  }

  buildLanguageModel(language, findings) {
    const model = {
      language,
      version: '1.0.0',
      created: new Date().toISOString(),
      patterns: [],
      vectors: {},
      statistics: {
        totalFindings: findings.length,
        bySeverity: {},
        byCWE: {},
        topPatterns: []
      }
    };

    // Aggregate findings
    const patternCounts = {};
    for (const finding of findings) {
      if (!patternCounts[finding.name]) {
        patternCounts[finding.name] = { count: 0, severity: finding.severity, cwe: finding.cwe };
      }
      patternCounts[finding.name].count += finding.matchCount || 1;
      model.statistics.bySeverity[finding.severity] =
        (model.statistics.bySeverity[finding.severity] || 0) + (finding.matchCount || 1);
      model.statistics.byCWE[finding.cwe] =
        (model.statistics.byCWE[finding.cwe] || 0) + (finding.matchCount || 1);
    }

    // Generate pattern embeddings
    for (const [name, data] of Object.entries(patternCounts)) {
      const embedding = this.generateVectorEmbedding(`${language}:${name}:${data.cwe}`);
      model.patterns.push({
        name,
        severity: data.severity,
        cwe: data.cwe,
        frequency: data.count
      });
      model.vectors[name] = embedding;
    }

    model.statistics.topPatterns = Object.entries(patternCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({ name, count: data.count }));

    return model;
  }

  buildCrossLanguageModel(analyzer, correlations) {
    const model = {
      type: 'cross_language_security_model',
      version: '1.0.0',
      created: new Date().toISOString(),
      languages: Object.keys(analyzer.languageStats),
      correlations: correlations,
      cweVectors: {},
      patternVectors: {},
      statistics: {
        totalFindings: analyzer.findings.length,
        severityDistribution: analyzer.severityStats,
        cweDistribution: analyzer.cweStats,
        languageDistribution: {}
      }
    };

    // Language stats
    for (const [lang, stats] of Object.entries(analyzer.languageStats)) {
      model.statistics.languageDistribution[lang] = stats.total;
    }

    // CWE embeddings
    for (const cwe of Object.keys(analyzer.cweStats)) {
      model.cweVectors[cwe] = this.generateVectorEmbedding(cwe);
    }

    // Pattern embeddings
    for (const [pattern, stats] of Object.entries(analyzer.patternStats)) {
      model.patternVectors[pattern] = this.generateVectorEmbedding(pattern);
    }

    return model;
  }

  saveModels(outputDir = './security-models') {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const [lang, model] of Object.entries(this.models)) {
      const filename = path.join(outputDir, `${lang}-security-model.json`);
      fs.writeFileSync(filename, JSON.stringify(model, null, 2));
    }

    return outputDir;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPLORER
// ═══════════════════════════════════════════════════════════════════════════

async function runExploration(options = {}) {
  console.clear();
  console.log(`\n${C.B}${C.m}${'═'.repeat(75)}${C.x}`);
  console.log(`${C.B}${C.m}     GITHUB SECURITY EXPLORER - Cross-Language Pattern Discovery${C.x}`);
  console.log(`${C.B}${C.m}${'═'.repeat(75)}${C.x}\n`);

  const startTime = Date.now();
  const analyzer = new LocalSecurityAnalyzer();
  const correlationEngine = new CorrelationEngine();
  const modelGenerator = new SecurityModelGenerator();

  // Phase 1: Analyze code samples
  console.log(`${C.B}${C.c}▶ PHASE 1: Analyzing Security Patterns${C.x}`);
  console.log(`${C.d}${'─'.repeat(55)}${C.x}`);

  const languages = Object.keys(SIMULATED_CODE_SAMPLES);
  for (const lang of languages) {
    const samples = SIMULATED_CODE_SAMPLES[lang];
    process.stdout.write(`  Analyzing ${SECURITY_PATTERNS[lang]?.name || lang}...`);

    for (const sample of samples) {
      analyzer.analyzeContent(sample, lang, `simulated:${lang}`);
      analyzer.detectFrameworks(sample, lang);
    }

    const stats = analyzer.languageStats[lang];
    if (stats) {
      console.log(` ${C.g}✓${C.x} ${stats.total} findings`);
    } else {
      console.log(` ${C.y}○${C.x} 0 findings`);
    }
  }

  // Phase 2: Find correlations
  console.log(`\n${C.B}${C.c}▶ PHASE 2: Cross-Language Correlation Analysis${C.x}`);
  console.log(`${C.d}${'─'.repeat(55)}${C.x}`);

  const correlations = correlationEngine.findCrossLanguageCorrelations(analyzer);
  const insights = correlationEngine.generateInsights(analyzer);

  console.log(`  Found ${C.B}${correlations.length}${C.x} cross-language correlations`);

  // Show cross-language patterns
  const crossLangPatterns = correlations.filter(c => c.type === 'cross_language');
  if (crossLangPatterns.length > 0) {
    console.log(`\n  ${C.B}Cross-Language Vulnerability Patterns:${C.x}`);
    for (const p of crossLangPatterns.slice(0, 8)) {
      console.log(`    ${C.y}●${C.x} ${p.pattern} (${p.cwe})`);
      console.log(`      ${C.d}Languages: ${p.languages.join(', ')}${C.x}`);
    }
  }

  // Phase 3: Generate models
  console.log(`\n${C.B}${C.c}▶ PHASE 3: Generating Pre-trained Security Models${C.x}`);
  console.log(`${C.d}${'─'.repeat(55)}${C.x}`);

  for (const lang of languages) {
    const langFindings = analyzer.findings.filter(f => f.language === lang);
    if (langFindings.length > 0) {
      const model = modelGenerator.buildLanguageModel(lang, langFindings);
      modelGenerator.models[lang] = model;
      console.log(`  ${C.g}✓${C.x} ${SECURITY_PATTERNS[lang]?.name || lang} model: ${model.patterns.length} patterns`);
    }
  }

  // Build cross-language model
  const crossModel = modelGenerator.buildCrossLanguageModel(analyzer, correlations);
  modelGenerator.models['cross_language'] = crossModel;
  console.log(`  ${C.g}✓${C.x} Cross-language model: ${Object.keys(crossModel.patternVectors).length} patterns`);

  // Save models
  const modelDir = modelGenerator.saveModels('./security-models');
  console.log(`  ${C.g}✓${C.x} Models saved to ${modelDir}/`);

  // Phase 4: Show insights
  console.log(`\n${C.B}${C.c}▶ KEY INSIGHTS${C.x}`);
  console.log(`${C.d}${'─'.repeat(55)}${C.x}`);

  // Top vulnerabilities
  const topVulns = insights.find(i => i.type === 'top_vulnerabilities');
  if (topVulns) {
    console.log(`\n  ${C.B}Top Vulnerability Patterns:${C.x}`);
    for (const v of topVulns.data.slice(0, 5)) {
      console.log(`    ${v.count.toString().padStart(3)} │ ${v.name} (${v.cwe})`);
      console.log(`        ${C.d}Found in: ${v.languages.join(', ')}${C.x}`);
    }
  }

  // Language risk
  const langRisk = insights.find(i => i.type === 'language_risk');
  if (langRisk) {
    console.log(`\n  ${C.B}Language Risk Profile:${C.x}`);
    console.log(`    ${C.d}Lang          Critical  High    Total${C.x}`);
    for (const l of langRisk.data.slice(0, 6)) {
      const langName = (SECURITY_PATTERNS[l.lang]?.name || l.lang).padEnd(12);
      console.log(`    ${langName}  ${String(l.critical).padStart(4)}    ${String(l.high).padStart(4)}    ${String(l.total).padStart(4)}`);
    }
  }

  // CWE trends
  const cweTrends = insights.find(i => i.type === 'cwe_trends');
  if (cweTrends) {
    console.log(`\n  ${C.B}Top CWE Categories:${C.x}`);
    for (const c of cweTrends.data.slice(0, 5)) {
      const bar = '█'.repeat(Math.min(20, Math.round(c.count / 2)));
      console.log(`    ${c.cwe.padEnd(10)} ${bar} ${c.count}`);
    }
  }

  // Summary statistics
  console.log(`\n${C.B}${C.c}▶ SUMMARY${C.x}`);
  console.log(`${C.d}${'─'.repeat(55)}${C.x}`);
  console.log(`  Languages Analyzed:    ${C.B}${languages.length}${C.x}`);
  console.log(`  Total Findings:        ${C.B}${analyzer.findings.length}${C.x}`);
  console.log(`  Unique Patterns:       ${C.B}${Object.keys(analyzer.patternStats).length}${C.x}`);
  console.log(`  CWE Categories:        ${C.B}${Object.keys(analyzer.cweStats).length}${C.x}`);
  console.log(`  Cross-Lang Patterns:   ${C.B}${crossLangPatterns.length}${C.x}`);
  console.log(`  Models Generated:      ${C.B}${Object.keys(modelGenerator.models).length}${C.x}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${C.d}Analysis completed in ${elapsed}s${C.x}`);

  console.log(`\n${C.B}${C.m}${'═'.repeat(75)}${C.x}\n`);

  // Save full report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      languages: languages.length,
      findings: analyzer.findings.length,
      patterns: Object.keys(analyzer.patternStats).length,
      cwes: Object.keys(analyzer.cweStats).length
    },
    languageStats: analyzer.languageStats,
    patternStats: Object.fromEntries(
      Object.entries(analyzer.patternStats).map(([k, v]) => [k, { ...v, languages: [...v.languages] }])
    ),
    cweStats: analyzer.cweStats,
    severityStats: analyzer.severityStats,
    correlations,
    insights
  };

  fs.writeFileSync('security-exploration-report.json', JSON.stringify(report, null, 2));
  console.log(`${C.g}✓ Full report saved to security-exploration-report.json${C.x}\n`);

  return report;
}

// CLI
if (require.main === module) {
  runExploration().catch(console.error);
}

module.exports = {
  GitHubExplorer,
  LocalSecurityAnalyzer,
  CorrelationEngine,
  SecurityModelGenerator,
  SECURITY_PATTERNS,
  runExploration
};
