0058C6F0  sub     esp, 10h
0058C6F3  mov     eax, [esp+10h+arg_0]
0058C6F7  mov     ecx, [esp+10h+arg_4]
0058C6FB  push    esi
0058C6FC  movsx   edx, word ptr [eax]
0058C6FF  movsx   esi, word ptr [ecx]
0058C702  sub     esi, edx
0058C704  sub     esp, 8
0058C707  movsx   edx, word ptr [eax+2]
0058C70B  movsx   eax, word ptr [ecx+2]
0058C70F  sub     eax, edx
0058C711  mov     edx, esi
0058C713  mov     ecx, eax
0058C715  imul    edx, esi
0058C718  imul    ecx, eax
0058C71B  add     ecx, edx
0058C71D  mov     dword ptr [esp+1Ch+var_10], esi
0058C721  mov     [esp+1Ch+arg_0], ecx
0058C725  mov     [esp+1Ch+arg_4], eax
0058C729  fild    [esp+1Ch+arg_0]
0058C72D  fstp    [esp+1Ch+var_1C]; double
0058C730  call    sub_4CAC40
0058C735  fstp    [esp+1Ch+var_8]
0058C739  add     esp, 8
0058C73C  test    esi, esi
0058C73E  jz      loc_58C7F4
0058C744  fild    [esp+14h+arg_4]
0058C748  sub     esp, 8
0058C74B  fidiv   dword ptr [esp+1Ch+var_10]
0058C74F  fchs
0058C751  fstp    [esp+1Ch+var_1C]; double
0058C754  call    sub_4CADE0
0058C759  add     esp, 8
0058C75C  test    esi, esi
0058C75E  jge     short loc_58C766
0058C760  fadd    ds:dbl_7E44D0
0058C766  fsub    [esp+14h+arg_8]
0058C76A  pop     esi
0058C76B  fabs
0058C76D  fcom    ds:dbl_7E3CC0
0058C773  fst     [esp+10h+arg_8]
0058C777  fnstsw  ax
0058C779  test    ah, 1
0058C77C  jnz     short loc_58C795
0058C77E  fsub    ds:dbl_7E3CC0
0058C784  fcom    ds:dbl_7E3CC0
0058C78A  fnstsw  ax
0058C78C  test    ah, 1
0058C78F  jz      short loc_58C77E
0058C791  fst     [esp+10h+arg_8]
0058C795  fcom    ds:dbl_7E44D0
0058C79B  fnstsw  ax
0058C79D  test    ah, 41h
0058C7A0  jnz     short loc_58C7AE
0058C7A2  fld     ds:dbl_7E3CC0
0058C7A8  fsub    st, st(1)
0058C7AA  fstp    [esp+10h+arg_8]
0058C7AE  mov     ecx, offset unk_ABE890
0058C7B3  fstp    st
0058C7B5  call    sub_65C780
0058C7BA  mov     dword ptr [esp+10h+var_10], eax
0058C7BE  mov     dword ptr [esp+10h+var_10+4], 0
0058C7C6  fild    [esp+10h+var_10]
0058C7CA  fmul    ds:dbl_7ED898
0058C7D0  fmul    ds:dbl_7ED6A8
0058C7D6  fld     ds:dbl_7ED6B8
0058C7DC  fmul    [esp+10h+arg_8]
0058C7E0  faddp   st(1), st
0058C7E2  fld     ds:dbl_7ED6B0
0058C7E8  fmul    [esp+10h+var_8]
0058C7EC  faddp   st(1), st
0058C7EE  add     esp, 10h
0058C7F1  retn    10h
0058C7F4  fld     ds:dbl_7E2820
0058C7FA  jmp     loc_58C766