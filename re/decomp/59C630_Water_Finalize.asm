0059C630  sub     esp, 18h
0059C633  mov     ecx, offset stru_87F7E8
0059C638  push    ebx
0059C639  push    esi
0059C63A  call    sub_578350
0059C63F  mov     ecx, offset stru_87F7E8
0059C644  call    sub_578290
0059C649  mov     esi, eax
0059C64B  xor     ebx, ebx
0059C64D  cmp     esi, ebx
0059C64F  jz      loc_59C7F3
0059C655  push    ebp
0059C656  push    edi
0059C657  mov     eax, [esi+38h]
0059C65A  mov     ecx, dword_AA0738
0059C660  cmp     eax, ecx
0059C662  jnz     loc_59C7DD
0059C668  cmp     [esi+11Ah], bl
0059C66E  jnz     loc_59C7DD
0059C674  push    2
0059C676  mov     ecx, esi
0059C678  call    sub_481810
0059C67D  push    4
0059C67F  mov     ecx, esi
0059C681  mov     edi, eax
0059C683  call    sub_481810
0059C688  push    3
0059C68A  mov     ecx, esi
0059C68C  mov     ebp, eax
0059C68E  call    sub_481810
0059C693  mov     ecx, dword_AA0738
0059C699  mov     edx, [edi+38h]
0059C69C  cmp     edx, ecx
0059C69E  jnz     loc_59C79C
0059C6A4  cmp     [edi+11Ah], bl
0059C6AA  jnz     loc_59C79C
0059C6B0  cmp     [ebp+38h], ecx
0059C6B3  jnz     loc_59C79C
0059C6B9  cmp     [ebp+11Ah], bl
0059C6BF  jnz     loc_59C79C
0059C6C5  cmp     [eax+38h], ecx
0059C6C8  jnz     loc_59C79C
0059C6CE  cmp     [eax+11Ah], bl
0059C6D4  jnz     loc_59C79C
0059C6DA  mov     ecx, offset unk_ABE890
0059C6DF  call    sub_65C780
0059C6E4  mov     dword ptr [esp+28h+var_18], eax
0059C6E8  mov     dword ptr [esp+28h+var_18+4], ebx
0059C6EC  fild    [esp+28h+var_18]
0059C6F0  fmul    ds:dbl_7ED9E8
0059C6F6  fadd    ds:dbl_7E1718
0059C6FC  call    sub_7C5F00
0059C701  cmp     eax, 0Ah
0059C704  ja      short loc_59C6DA
0059C706  cmp     eax, 1
0059C709  jz      loc_59C79C
0059C70F  mov     ecx, offset unk_ABE890
0059C714  call    sub_65C780
0059C719  mov     dword ptr [esp+28h+var_10], eax
0059C71D  mov     dword ptr [esp+28h+var_10+4], ebx
0059C721  fild    [esp+28h+var_10]
0059C725  fmul    ds:dbl_7ED9E0
0059C72B  call    sub_7C5F00
0059C730  mov     ecx, eax
0059C732  cmp     ecx, 0F1h
0059C738  ja      short loc_59C70F
0059C73A  cmp     ecx, 0F0h
0059C740  jl      short loc_59C74B
0059C742  mov     edi, 0F7h
0059C747  sub     edi, ecx
0059C749  jmp     short loc_59C75E
0059C74B  mov     eax, 66666667h
0059C750  imul    ecx
0059C752  sar     edx, 4
0059C755  mov     ecx, edx
0059C757  shr     ecx, 1Fh
0059C75A  add     edx, ecx
0059C75C  mov     edi, edx
0059C75E  mov     ecx, dword_ABED10
0059C764  lea     edx, [esi+24h]
0059C767  cmp     ecx, ebx
0059C769  jnz     short loc_59C770
0059C76B  or      eax, 0FFFFFFFFh
0059C76E  jmp     short loc_59C78A
0059C770  movsx   eax, word ptr [edx+2]
0059C774  imul    eax, dword_89C2DC
0059C77B  movsx   esi, word ptr [edx]
0059C77E  add     eax, esi
0059C780  lea     eax, [eax+eax*4]
0059C783  shl     eax, 4
0059C786  mov     eax, [eax+ecx+38h]
0059C78A  mov     ecx, dword_AA0738
0059C790  push    0FFFFFFFFh
0059C792  push    eax
0059C793  add     ecx, edi
0059C795  call    sub_5A6C10
0059C79A  jmp     short loc_59C7DD
0059C79C  mov     ecx, offset unk_ABE890
0059C7A1  call    sub_65C780
0059C7A6  mov     dword ptr [esp+28h+var_8], eax
0059C7AA  mov     dword ptr [esp+28h+var_8+4], ebx
0059C7AE  fild    [esp+28h+var_8]
0059C7B2  fmul    ds:dbl_7ED9D8
0059C7B8  call    sub_7C5F00
0059C7BD  mov     ecx, eax
0059C7BF  cmp     ecx, 0C8h
0059C7C5  ja      short loc_59C79C
0059C7C7  mov     eax, 0CCCCCCCDh
0059C7CC  mul     ecx
0059C7CE  mov     eax, dword_AA0738
0059C7D3  shr     edx, 5
0059C7D6  lea     ecx, [edx+eax+8]
0059C7DA  mov     [esi+38h], ecx
0059C7DD  mov     ecx, offset stru_87F7E8
0059C7E2  call    sub_578290
0059C7E7  mov     esi, eax
0059C7E9  cmp     esi, ebx
0059C7EB  jnz     loc_59C657
0059C7F1  pop     edi
0059C7F2  pop     ebp
0059C7F3  pop     esi
0059C7F4  pop     ebx
0059C7F5  add     esp, 18h
0059C7F8  retn