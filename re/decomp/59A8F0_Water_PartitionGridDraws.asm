0059A8F0  sub     esp, 74h
0059A8F3  fild    [esp+74h+arg_4]
0059A8F7  push    ebx
0059A8F8  push    ebp
0059A8F9  push    esi
0059A8FA  push    edi
0059A8FB  sub     esp, 8
0059A8FE  fstp    [esp+8Ch+var_8C]; double
0059A901  call    sub_4CAC40
0059A906  add     esp, 8
0059A909  call    sub_7C5F00
0059A90E  mov     ecx, eax
0059A910  mov     edi, [esp+84h+arg_4]
0059A917  imul    ecx, eax
0059A91A  cmp     ecx, edi
0059A91C  mov     dword ptr [esp+84h+var_50+4], eax
0059A920  jnz     short loc_59A92A
0059A922  mov     ebx, eax
0059A924  mov     [esp+84h+var_64], ebx
0059A928  jmp     short loc_59A933
0059A92A  lea     edx, [eax+1]
0059A92D  mov     [esp+84h+var_64], edx
0059A931  mov     ebx, edx
0059A933  mov     ecx, ebx
0059A935  imul    ecx, eax
0059A938  cmp     ecx, edi
0059A93A  jl      short loc_59A944
0059A93C  mov     esi, eax
0059A93E  mov     [esp+84h+var_74], esi
0059A942  jmp     short loc_59A94A
0059A944  mov     [esp+84h+var_74], ebx
0059A948  mov     esi, ebx
0059A94A  mov     ebp, [esp+84h+arg_8]
0059A951  mov     ecx, offset unk_ABE890
0059A956  mov     eax, [ebp+8]
0059A959  cdq
0059A95A  idiv    ebx
0059A95C  mov     [esp+84h+var_70], eax
0059A960  mov     eax, [ebp+0Ch]
0059A963  cdq
0059A964  idiv    ebx
0059A966  mov     dword ptr [esp+84h+var_6C], eax
0059A96A  xor     eax, eax
0059A96C  mov     [esp+84h+var_54], eax
0059A970  mov     dword ptr [esp+84h+var_50], eax
0059A974  mov     dword ptr [esp+84h+var_6C+4], eax
0059A978  mov     [esp+84h+var_60], eax
0059A97C  call    sub_65C780
0059A981  mov     dword ptr [esp+84h+var_48], eax
0059A985  mov     dword ptr [esp+84h+var_48+4], 0
0059A98D  fild    [esp+84h+var_48]
0059A991  fmul    ds:dbl_7ED898
0059A997  fcomp   ds:dbl_7E1738
0059A99D  fnstsw  ax
0059A99F  test    ah, 1
0059A9A2  jz      short loc_59A9BC
0059A9A4  mov     eax, [ebp+8]
0059A9A7  cdq
0059A9A8  idiv    esi
0059A9AA  mov     edx, dword ptr [esp+84h+var_6C]
0059A9AE  mov     [esp+84h+var_60], edx
0059A9B2  mov     [esp+84h+var_70], eax
0059A9B6  mov     [esp+84h+var_54], eax
0059A9BA  jmp     short loc_59A9D2
0059A9BC  mov     eax, [ebp+0Ch]
0059A9BF  mov     ecx, [esp+84h+var_70]
0059A9C3  cdq
0059A9C4  idiv    esi
0059A9C6  mov     dword ptr [esp+84h+var_6C+4], ecx
0059A9CA  mov     dword ptr [esp+84h+var_6C], eax
0059A9CE  mov     dword ptr [esp+84h+var_50], eax
0059A9D2  imul    esi, ebx
0059A9D5  mov     ecx, [ebp+4]
0059A9D8  mov     eax, [ebp+0]
0059A9DB  sub     esi, edi
0059A9DD  xor     edi, edi
0059A9DF  mov     dword ptr [esp+84h+var_48+4], ecx
0059A9E3  push    edi
0059A9E4  push    edi
0059A9E5  lea     ecx, [esp+8Ch+var_18]
0059A9E9  mov     dword ptr [esp+8Ch+var_48], eax
0059A9ED  call    sub_477BE0
0059A9F2  push    edi
0059A9F3  push    edi
0059A9F4  lea     ecx, [esp+8Ch+var_30]
0059A9F8  mov     [esp+8Ch+var_18], offset ??_7?$DynamicVectorClass@H@@6B@; const DynamicVectorClass<int>::`vftable'
0059AA00  mov     [esp+8Ch+var_4], 0Ah
0059AA0B  mov     [esp+8Ch+var_8], edi
0059AA12  call    sub_477BE0
0059AA17  mov     eax, [esp+84h+var_74]
0059AA1B  xor     ecx, ecx
0059AA1D  test    eax, eax
0059AA1F  mov     [esp+84h+var_30], offset ??_7?$DynamicVectorClass@H@@6B@; const DynamicVectorClass<int>::`vftable'
0059AA27  mov     [esp+84h+var_1C], 0Ah
0059AA2F  mov     [esp+84h+var_20], ecx
0059AA33  jle     loc_59AAD9
0059AA39  mov     eax, [esp+84h+var_10]
0059AA3D  mov     ecx, [esp+84h+var_8]
0059AA41  cmp     ecx, eax
0059AA43  jl      short loc_59AA70
0059AA45  mov     cl, [esp+84h+var_B]
0059AA49  test    cl, cl
0059AA4B  jnz     short loc_59AA51
0059AA4D  test    eax, eax
0059AA4F  jnz     short loc_59AA82
0059AA51  mov     ecx, [esp+84h+var_4]
0059AA58  test    ecx, ecx
0059AA5A  jle     short loc_59AA82
0059AA5C  mov     edx, [esp+84h+var_18]
0059AA60  add     eax, ecx
0059AA62  push    0
0059AA64  push    eax
0059AA65  lea     ecx, [esp+8Ch+var_18]
0059AA69  call    dword ptr [edx+8]
0059AA6C  test    al, al
0059AA6E  jz      short loc_59AA82
0059AA70  mov     ecx, [esp+84h+var_8]
0059AA74  mov     eax, ecx
0059AA76  inc     ecx
0059AA77  mov     [esp+84h+var_8], ecx
0059AA7B  mov     ecx, [esp+84h+var_14]
0059AA7F  mov     [ecx+eax*4], ebx
0059AA82  mov     eax, [esp+84h+var_28]
0059AA86  mov     ecx, [esp+84h+var_20]
0059AA8A  cmp     ecx, eax
0059AA8C  jl      short loc_59AAB6
0059AA8E  mov     cl, byte ptr [esp+84h+var_24+1]
0059AA92  test    cl, cl
0059AA94  jnz     short loc_59AA9A
0059AA96  test    eax, eax
0059AA98  jnz     short loc_59AAC8
0059AA9A  mov     ecx, [esp+84h+var_1C]
0059AA9E  test    ecx, ecx
0059AAA0  jle     short loc_59AAC8
0059AAA2  mov     edx, [esp+84h+var_30]
0059AAA6  add     eax, ecx
0059AAA8  push    0
0059AAAA  push    eax
0059AAAB  lea     ecx, [esp+8Ch+var_30]
0059AAAF  call    dword ptr [edx+8]
0059AAB2  test    al, al
0059AAB4  jz      short loc_59AAC8
0059AAB6  mov     ecx, [esp+84h+var_20]
0059AABA  mov     eax, ecx
0059AABC  inc     ecx
0059AABD  mov     [esp+84h+var_20], ecx
0059AAC1  mov     ecx, [esp+84h+Block]
0059AAC5  mov     [ecx+eax*4], edi
0059AAC8  mov     eax, [esp+84h+var_74]
0059AACC  inc     edi
0059AACD  cmp     edi, eax
0059AACF  jl      loc_59AA39
0059AAD5  mov     ecx, [esp+84h+var_20]
0059AAD9  test    esi, esi
0059AADB  jle     loc_59AB68
0059AAE1  mov     edi, esi
0059AAE3  lea     esi, [ecx-1]
0059AAE6  mov     dword ptr [esp+84h+var_5C+4], 0
0059AAEE  lea     edx, [esi+1]
0059AAF1  mov     dword ptr [esp+84h+var_5C], edx
0059AAF5  fild    [esp+84h+var_5C]
0059AAF9  fstp    [esp+84h+var_38]
0059AAFD  mov     ecx, offset unk_ABE890
0059AB02  call    sub_65C780
0059AB07  mov     dword ptr [esp+84h+var_40], eax
0059AB0B  mov     dword ptr [esp+84h+var_40+4], 0
0059AB13  fild    [esp+84h+var_40]
0059AB17  fmul    [esp+84h+var_38]
0059AB1B  fmul    ds:dbl_7ED898
0059AB21  call    sub_7C5F00
0059AB26  cmp     eax, esi
0059AB28  ja      short loc_59AAFD
0059AB2A  mov     ecx, [esp+84h+Block]
0059AB2E  mov     esi, dword ptr [esp+84h+var_50+4]
0059AB32  mov     edx, [ecx+eax*4]
0059AB35  mov     ecx, [esp+84h+var_14]
0059AB39  mov     [ecx+edx*4], esi
0059AB3C  mov     ecx, [esp+84h+var_20]
0059AB40  cmp     eax, ecx
0059AB42  jge     short loc_59AB61
0059AB44  dec     ecx
0059AB45  cmp     eax, ecx
0059AB47  mov     [esp+84h+var_20], ecx
0059AB4B  jge     short loc_59AB61
0059AB4D  mov     ecx, [esp+84h+Block]
0059AB51  inc     eax
0059AB52  mov     edx, [ecx+eax*4]
0059AB55  mov     [ecx+eax*4-4], edx
0059AB59  mov     ecx, [esp+84h+var_20]
0059AB5D  cmp     eax, ecx
0059AB5F  jl      short loc_59AB4D
0059AB61  dec     edi
0059AB62  jnz     loc_59AAE3
0059AB68  mov     eax, [esp+84h+var_74]
0059AB6C  xor     edi, edi
0059AB6E  test    eax, eax
0059AB70  mov     dword ptr [esp+84h+var_50+4], edi
0059AB74  jle     loc_59ACAD
0059AB7A  mov     esi, [esp+84h+arg_0]
0059AB81  mov     eax, [esp+84h+var_14]
0059AB85  mov     ecx, [eax+edi*4]
0059AB88  cmp     ecx, ebx
0059AB8A  jge     short loc_59ABBC
0059AB8C  mov     eax, dword ptr [esp+84h+var_6C+4]
0059AB90  test    eax, eax
0059AB92  jle     short loc_59ABA9
0059AB94  mov     eax, [esp+84h+var_70]
0059AB98  cdq
0059AB99  sub     eax, edx
0059AB9B  mov     edx, dword ptr [esp+84h+var_48]
0059AB9F  sar     eax, 1
0059ABA1  add     edx, eax
0059ABA3  mov     dword ptr [esp+84h+var_48], edx
0059ABA7  jmp     short loc_59ABBC
0059ABA9  mov     eax, dword ptr [esp+84h+var_6C]
0059ABAD  cdq
0059ABAE  sub     eax, edx
0059ABB0  mov     edx, dword ptr [esp+84h+var_48+4]
0059ABB4  sar     eax, 1
0059ABB6  add     edx, eax
0059ABB8  mov     dword ptr [esp+84h+var_48+4], edx
0059ABBC  test    ecx, ecx
0059ABBE  jle     loc_59AC68
0059ABC4  mov     edx, [esp+84h+var_70]
0059ABC8  mov     dword ptr [esp+84h+var_5C], ecx
0059ABCC  lea     ebx, [edx-4]
0059ABCF  mov     eax, dword ptr [esp+84h+var_48]
0059ABD3  mov     ecx, dword ptr [esp+84h+var_48+4]
0059ABD7  lea     edi, [eax+2]
0059ABDA  mov     eax, [esi+8]
0059ABDD  lea     ebp, [ecx+2]
0059ABE0  mov     ecx, [esi+10h]
0059ABE3  cmp     ecx, eax
0059ABE5  jl      short loc_59AC09
0059ABE7  mov     cl, [esi+0Dh]
0059ABEA  test    cl, cl
0059ABEC  jnz     short loc_59ABF2
0059ABEE  test    eax, eax
0059ABF0  jnz     short loc_59AC2E
0059ABF2  mov     ecx, [esi+14h]
0059ABF5  test    ecx, ecx
0059ABF7  jle     short loc_59AC2E
0059ABF9  mov     edx, [esi]
0059ABFB  add     ecx, eax
0059ABFD  push    0
0059ABFF  push    ecx
0059AC00  mov     ecx, esi
0059AC02  call    dword ptr [edx+8]
0059AC05  test    al, al
0059AC07  jz      short loc_59AC2E
0059AC09  mov     eax, [esi+10h]
0059AC0C  lea     ecx, [eax+1]
0059AC0F  mov     [esi+10h], ecx
0059AC12  mov     ecx, [esi+4]
0059AC15  shl     eax, 4
0059AC18  add     eax, ecx
0059AC1A  mov     edx, eax
0059AC1C  mov     eax, dword ptr [esp+84h+var_6C]
0059AC20  add     eax, 0FFFFFFFCh
0059AC23  mov     [edx], edi
0059AC25  mov     [edx+4], ebp
0059AC28  mov     [edx+8], ebx
0059AC2B  mov     [edx+0Ch], eax
0059AC2E  mov     ecx, dword ptr [esp+84h+var_6C+4]
0059AC32  mov     edx, dword ptr [esp+84h+var_48]
0059AC36  mov     eax, dword ptr [esp+84h+var_5C]
0059AC3A  add     edx, ecx
0059AC3C  mov     ecx, dword ptr [esp+84h+var_48+4]
0059AC40  mov     dword ptr [esp+84h+var_48], edx
0059AC44  mov     edx, [esp+84h+var_60]
0059AC48  add     ecx, edx
0059AC4A  dec     eax
0059AC4B  mov     dword ptr [esp+84h+var_48+4], ecx
0059AC4F  mov     dword ptr [esp+84h+var_5C], eax
0059AC53  jnz     loc_59ABCF
0059AC59  mov     ebx, [esp+84h+var_64]
0059AC5D  mov     ebp, [esp+84h+arg_8]
0059AC64  mov     edi, dword ptr [esp+84h+var_50+4]
0059AC68  mov     eax, [esp+84h+var_54]
0059AC6C  mov     ecx, dword ptr [esp+84h+var_48]
0059AC70  mov     edx, dword ptr [esp+84h+var_48+4]
0059AC74  add     ecx, eax
0059AC76  mov     eax, dword ptr [esp+84h+var_6C+4]
0059AC7A  mov     dword ptr [esp+84h+var_48], ecx
0059AC7E  mov     ecx, dword ptr [esp+84h+var_50]
0059AC82  add     edx, ecx
0059AC84  test    eax, eax
0059AC86  mov     dword ptr [esp+84h+var_48+4], edx
0059AC8A  jle     short loc_59AC95
0059AC8C  mov     edx, [ebp+0]
0059AC8F  mov     dword ptr [esp+84h+var_48], edx
0059AC93  jmp     short loc_59AC9C
0059AC95  mov     eax, [ebp+4]
0059AC98  mov     dword ptr [esp+84h+var_48+4], eax
0059AC9C  mov     eax, [esp+84h+var_74]
0059ACA0  inc     edi
0059ACA1  cmp     edi, eax
0059ACA3  mov     dword ptr [esp+84h+var_50+4], edi
0059ACA7  jl      loc_59AB81
0059ACAD  mov     eax, [esp+84h+Block]
0059ACB1  mov     esi, offset ??_7?$VectorClass@H@@6B@; const VectorClass<int>::`vftable'
0059ACB6  test    eax, eax
0059ACB8  mov     [esp+84h+var_30], esi
0059ACBC  jz      short loc_59ACD7
0059ACBE  mov     cl, byte ptr [esp+84h+var_24+1]
0059ACC2  test    cl, cl
0059ACC4  jz      short loc_59ACD7
0059ACC6  push    eax; Block
0059ACC7  call    ??3@YAXPAX@Z; operator delete(void *)
0059ACCC  add     esp, 4
0059ACCF  mov     [esp+84h+Block], 0
0059ACD7  mov     eax, [esp+84h+var_14]
0059ACDB  mov     [esp+84h+var_18], esi
0059ACDF  pop     edi
0059ACE0  pop     esi
0059ACE1  pop     ebp
0059ACE2  mov     byte ptr [esp+78h+var_24+1], 0
0059ACE7  test    eax, eax
0059ACE9  mov     [esp+78h+var_28], 0
0059ACF1  pop     ebx
0059ACF2  jz      short loc_59AD05
0059ACF4  mov     cl, [esp+74h+var_B]
0059ACF8  test    cl, cl
0059ACFA  jz      short loc_59AD05
0059ACFC  push    eax; Block
0059ACFD  call    ??3@YAXPAX@Z; operator delete(void *)
0059AD02  add     esp, 4
0059AD05  add     esp, 74h
0059AD08  retn    0Ch