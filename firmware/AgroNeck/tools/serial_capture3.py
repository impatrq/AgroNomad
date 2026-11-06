#!/usr/bin/env python3
"""Serial capture with inline gap markers written into the log itself."""
import os, sys, time, termios, fcntl, struct

TIOCM_DTR = 0x002
TIOCM_RTS = 0x004
TIOCMBIS = 0x5416
TIOCMBIC = 0x5417

def bit(fd, op, flag):
    fcntl.ioctl(fd, op, struct.pack('i', flag))

def main():
    port = sys.argv[1] if len(sys.argv) > 1 else '/dev/ttyUSB0'
    out = sys.argv[2] if len(sys.argv) > 2 else 'serial_ordered.log'
    secs = float(sys.argv[3]) if len(sys.argv) > 3 else 60.0
    reset = (sys.argv[4] if len(sys.argv) > 4 else 'yes') == 'yes'

    fd = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    iflag, oflag, cflag, lflag, ispeed, ospeed, cc = termios.tcgetattr(fd)
    iflag = 0; oflag = 0; lflag = 0
    cflag = (cflag & ~(termios.CSIZE | termios.PARENB | termios.CSTOPB)) \
            | termios.CS8 | termios.CREAD | termios.CLOCAL
    cc = list(cc); cc[termios.VMIN] = 0; cc[termios.VTIME] = 0
    termios.tcsetattr(fd, termios.TCSANOW, [iflag, oflag, cflag, lflag,
                                            termios.B115200, termios.B115200, cc])
    termios.tcflush(fd, termios.TCIOFLUSH)

    if reset:
        bit(fd, TIOCMBIC, TIOCM_DTR)
        bit(fd, TIOCMBIS, TIOCM_RTS)
        time.sleep(0.15)
        bit(fd, TIOCMBIC, TIOCM_RTS)

    start = time.time()
    last = start
    with open(out, 'wb') as f:
        f.write(b'### CAPTURE START reset=%s\n' % (b'yes' if reset else b'no'))
        while time.time() - start < secs:
            try:
                chunk = os.read(fd, 4096)
            except BlockingIOError:
                chunk = b''
            now = time.time()
            if chunk:
                gap = now - last
                if gap > 0.5:
                    f.write(b'\n<<<GAP %.2fs (wall %.2fs)>>>\n' % (gap, now - start))
                last = now
                f.write(chunk); f.flush()
            else:
                time.sleep(0.005)
        f.write(b'\n### CAPTURE END\n')
    os.close(fd)

if __name__ == '__main__':
    main()
