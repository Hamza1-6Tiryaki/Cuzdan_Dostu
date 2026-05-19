import psutil

def kill_port(port):
    killed = False
    for conn in psutil.net_connections():
        if conn.laddr.port == port:
            try:
                proc = psutil.Process(conn.pid)
                print(f"Killing PID {conn.pid} on port {port}")
                proc.kill()
                killed = True
            except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                print(f"Could not kill PID {conn.pid} on port {port}: {e}")
    if not killed:
        print(f"No process listening on port {port}")

if __name__ == '__main__':
    kill_port(8000)
    kill_port(5173)
