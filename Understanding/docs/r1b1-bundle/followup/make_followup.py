import json
def cs(arms=(), th=()): return {"arms":[list(a) for a in arms], "thenable": list(th)}
def ex(steps, entry, body, inArm, status, program):
    return {"id":"f","steps":steps,"entry":entry,"body":body,"inArm":inArm,"armStatus":status,"awaitTarget":[],"program":program,"completion":[],"predicates":[]}
steps=[["x","call"],["B","branch"],["u","call"],["v","call"],["end","exit","implicit"]]
body=["x",{"branch":"B","then":["u"],"else":[]},"v"]
st=[["B","then","falls-through"],["B","else","falls-through"]]
prog=[["x","B",None],["B","u","then"],["B","v","else"],["u","v",None],["v","end",None]]
CA0={"id":"CA0","language":"typescript","executables":[ex(steps,["x"],body,[["u","B","then"]],st,prog)],
     "expect":{"refusals":[],"completeness":{},"required":[["x.return","u.invoke",[cs([("B","then")])]],["x.return","v.invoke",[cs([("B","else")]),cs([("B","then")])]]],"forbidden":[]}}
CA1={"id":"CA1","language":"typescript","executables":[ex(steps,["x"],body,[["u","B","else"]],st,prog)],
     "expect":{"refusals":[],"completeness":{},"required":[["x.return","v.invoke",[cs([("B","else")])]]],"forbidden":[["x.return","u.invoke"]]}}
steps2=[["B","branch"],["u","call"],["v","call"],["end","exit","implicit"]]
body2=[{"branch":"B","then":["u"],"else":["v"]}]
prog2=[["B","u","then"],["u","v",None],["B","v","else"],["v","end",None]]
CA2={"id":"CA2","language":"typescript","executables":[ex(steps2,["B"],body2,[["u","B","then"],["v","B","else"]],st,prog2)],
     "expect":{"refusals":[],"completeness":{},"required":[],"forbidden":[["u.return","v.invoke"]]}}
roles={
 ("R13","AWAIT_TARGET to a non-call step"):{"primary":["R13"],"consequent":[["R12","R13"]]},
 ("R13","AWAIT_TARGET to another executable's call"):{"primary":["R13"],"consequent":[["R12","R13"]]},
 ("R13","call step with class unresolved"):{"primary":["R13"],"consequent":[["R12","R13"]]},
 ("R13","literal with class call-result"):{"primary":["R13"],"consequent":[["R12","R13"]]},
 ("R12","await without AWAIT_TARGET"):{"primary":["R12"],"consequent":[]},
 ("R12","await with two AWAIT_TARGET"):{"primary":["R12"],"consequent":[]},
 ("R18","entry missing"):{"primary":["R18"],"consequent":[]},
 ("R18","entry duplicated"):{"primary":["R18"],"consequent":[]},
 ("R18","entry owned by another executable"):{"primary":["R18"],"consequent":[["R18","R18"]]},
 ("R18","entry with an incoming program fact"):{"primary":["R18"],"consequent":[]},
}
F={"version":"r1b1-followup-1","baseManifestSha256":"072b51013d2b85eae9d3c15954a3388cb398f94f94b8b7fdb662b319a2b33ecf",
   "diagnosticControls":[{"rule":k[0],"alt":k[1],**v} for k,v in roles.items()],
   "allOtherRefusalControls":"primary set equals the frozen manifest's expected set; consequent set empty",
   "conflictingArm":[CA0,CA1,CA2],
   "sabotage":{"description":"the same chain-derivation function with its conflicting-arm check removed","mustFail":["CA1","CA2"],"mustStillPass":["CA0"]}}
open("followup.json","w").write(json.dumps(F,indent=1,sort_keys=True)+"\n")
print("ok")
