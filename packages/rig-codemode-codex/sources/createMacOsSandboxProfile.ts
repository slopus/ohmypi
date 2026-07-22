export function createMacOsSandboxProfile(binaryPath: string): string {
    const binary = JSON.stringify(binaryPath);
    return `(version 1)
(deny default)

; Permit the initial Code Mode exec and normal in-sandbox process bookkeeping.
(allow process-exec (literal ${binary}))
(allow process-info* (target same-sandbox))
(allow signal (target same-sandbox))

; V8 runtime and CPU feature detection.
(allow sysctl-read)
(allow iokit-open (iokit-registry-entry-class "RootDomainUserClient"))
(allow mach-lookup (global-name "com.apple.PowerManagement.control"))
(allow system-mac-syscall)

; The host executable, Apple runtime libraries, and standard read-only data.
(allow file-read* file-test-existence
  (literal ${binary})
  (literal "/")
  (subpath "/Library/Apple")
  (subpath "/System/Library")
  (subpath "/usr/lib")
  (subpath "/usr/share")
  (subpath "/private/var/db/timezone")
  (literal "/private/etc/localtime")
  (literal "/dev/null")
  (literal "/dev/zero")
  (literal "/dev/random")
  (literal "/dev/urandom")
  (subpath "/dev/fd"))

(allow file-map-executable
  (literal ${binary})
  (subpath "/Library/Apple")
  (subpath "/System/Library")
  (subpath "/usr/lib"))

; Protocol I/O remains on the inherited pipes. No general filesystem writes.
(allow file-read-data (subpath "/dev/fd"))
(allow file-write-data
  (literal "/dev/null")
  (subpath "/dev/fd"))

; Defense in depth: networking remains denied even if defaults change.
(deny network-inbound)
(deny network-outbound)
`;
}
