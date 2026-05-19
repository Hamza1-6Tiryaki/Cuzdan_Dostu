import subprocess

print("=== RUNNING PYTHON PROCESSES ===")
try:
    output = subprocess.check_output("tasklist /FO CSV", shell=True).decode('utf-8', errors='ignore')
    lines = output.strip().split("\n")
    header = lines[0]
    print(header)
    for line in lines[1:]:
        if "python" in line.lower():
            print(line)
except Exception as e:
    print("Error querying tasklist:", e)
